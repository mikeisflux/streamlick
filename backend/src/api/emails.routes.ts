import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../auth/middleware';
import sgMail from '@sendgrid/mail';
import multer from 'multer';
import { encrypt, decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Get SendGrid API key from system settings
async function getSendGridApiKey(): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: {
        category: 'system',
        key: 'sendgrid_api_key',
      },
    });

    if (setting?.value) {
      try {
        return decrypt(setting.value);
      } catch {
        return setting.value; // If decryption fails, return as-is
      }
    }
    return process.env.SENDGRID_API_KEY || null;
  } catch (error) {
    logger.error('Error getting SendGrid API key:', error);
    return process.env.SENDGRID_API_KEY || null;
  }
}

// Get all mailboxes
router.get('/mailboxes', authenticate, async (req: AuthRequest, res) => {
  try {
    const mailboxes = await prisma.mailbox.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(mailboxes);
  } catch (error) {
    logger.error('Get mailboxes error:', error);
    res.status(500).json({ error: 'Failed to get mailboxes' });
  }
});

// Create new mailbox
router.post('/mailboxes', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      email,
      password,
      type,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      syncFrequency,
      autoReply,
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const mailbox = await prisma.mailbox.create({
      data: {
        name,
        email,
        password: password ? encrypt(password) : null,
        type: type || 'sendgrid',
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        syncFrequency,
        autoReply,
        isActive: true,
      },
    });

    res.status(201).json({
      id: mailbox.id,
      name: mailbox.name,
      email: mailbox.email,
      type: mailbox.type,
      isActive: mailbox.isActive,
    });
  } catch (error: any) {
    logger.error('Create mailbox error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create mailbox' });
  }
});

// Delete mailbox
router.delete('/mailboxes/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.mailbox.delete({
      where: { id },
    });

    res.json({ message: 'Mailbox deleted successfully' });
  } catch (error) {
    logger.error('Delete mailbox error:', error);
    res.status(500).json({ error: 'Failed to delete mailbox' });
  }
});

// Get emails for a mailbox
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { mailboxId, folder = 'inbox', limit = 50, offset = 0 } = req.query;

    const where: any = {};

    if (mailboxId) {
      where.mailboxId = mailboxId as string;
    }

    // Filter by folder (inbox = received, sent = sent)
    if (folder === 'inbox') {
      where.direction = 'inbound';
    } else if (folder === 'sent') {
      where.direction = 'outbound';
    }

    const emails = await prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      select: {
        id: true,
        mailboxId: true,
        fromEmail: true,
        fromName: true,
        toEmail: true,
        subject: true,
        bodyText: true,
        bodyHtml: true,
        attachments: true,
        direction: true,
        status: true,
        isRead: true,
        sentAt: true,
        receivedAt: true,
        createdAt: true,
      },
    });

    // Parse attachments JSON
    const parsedEmails = emails.map(email => ({
      ...email,
      attachments: email.attachments ? JSON.parse(email.attachments) : [],
    }));

    res.json(parsedEmails);
  } catch (error) {
    logger.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Get single email
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const email = await prisma.email.findUnique({
      where: { id },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Mark as read
    if (!email.isRead) {
      await prisma.email.update({
        where: { id },
        data: { isRead: true },
      });
    }

    res.json({
      ...email,
      attachments: email.attachments ? JSON.parse(email.attachments) : [],
      headers: email.headers ? JSON.parse(email.headers) : {},
    });
  } catch (error) {
    logger.error('Get email error:', error);
    res.status(500).json({ error: 'Failed to get email' });
  }
});

// Send new email
router.post('/', authenticate, upload.array('attachments', 10), async (req: AuthRequest, res) => {
  try {
    const {
      mailboxId,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
    } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'To and subject are required' });
    }

    // Get SendGrid API key
    const apiKey = await getSendGridApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'SendGrid API key not configured' });
    }

    sgMail.setApiKey(apiKey);

    // Prepare attachments
    const attachments: any[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        attachments.push({
          content: file.buffer.toString('base64'),
          filename: file.originalname,
          type: file.mimetype,
          disposition: 'attachment',
        });
      }
    }

    // Send email via SendGrid
    const msg: any = {
      to: to.split(',').map((e: string) => e.trim()),
      from: from || process.env.DEFAULT_FROM_EMAIL || 'noreply@streamlick.com',
      subject,
      text: bodyText,
      html: bodyHtml || bodyText,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    if (cc) {
      msg.cc = cc.split(',').map((e: string) => e.trim());
    }

    if (bcc) {
      msg.bcc = bcc.split(',').map((e: string) => e.trim());
    }

    if (inReplyTo) {
      msg.replyTo = inReplyTo;
    }

    await sgMail.send(msg);

    // Store email in database
    const email = await prisma.email.create({
      data: {
        mailboxId: mailboxId || null,
        fromEmail: msg.from,
        fromName: null,
        toEmail: to,
        ccEmails: cc || null,
        bccEmails: bcc || null,
        subject,
        bodyText,
        bodyHtml: bodyHtml || bodyText,
        attachments: attachments.length > 0 ? JSON.stringify(attachments.map(a => ({
          filename: a.filename,
          type: a.type,
        }))) : null,
        direction: 'outbound',
        status: 'sent',
        sentAt: new Date(),
        inReplyTo: inReplyTo || null,
      },
    });

    res.status(201).json({
      id: email.id,
      status: 'sent',
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    logger.error('Send email error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
    });
  }
});

// Reply to email
router.post('/:id/reply', authenticate, upload.array('attachments', 10), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { bodyText, bodyHtml, mailboxId } = req.body;

    // Get original email
    const originalEmail = await prisma.email.findUnique({
      where: { id },
    });

    if (!originalEmail) {
      return res.status(404).json({ error: 'Original email not found' });
    }

    // Get SendGrid API key
    const apiKey = await getSendGridApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'SendGrid API key not configured' });
    }

    sgMail.setApiKey(apiKey);

    // Prepare attachments
    const attachments: any[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        attachments.push({
          content: file.buffer.toString('base64'),
          filename: file.originalname,
          type: file.mimetype,
          disposition: 'attachment',
        });
      }
    }

    // Send reply
    const msg: any = {
      to: originalEmail.fromEmail || '',
      from: originalEmail.toEmail || process.env.DEFAULT_FROM_EMAIL || 'noreply@streamlick.com',
      subject: `Re: ${originalEmail.subject}`,
      text: bodyText,
      html: bodyHtml || bodyText,
      attachments: attachments.length > 0 ? attachments : undefined,
      replyTo: originalEmail.toEmail || undefined,
    };

    await sgMail.send(msg);

    // Store reply in database
    const replyEmail = await prisma.email.create({
      data: {
        mailboxId: mailboxId || originalEmail.mailboxId,
        fromEmail: msg.from,
        toEmail: msg.to,
        subject: msg.subject,
        bodyText,
        bodyHtml: bodyHtml || bodyText,
        attachments: attachments.length > 0 ? JSON.stringify(attachments.map(a => ({
          filename: a.filename,
          type: a.type,
        }))) : null,
        direction: 'outbound',
        status: 'sent',
        sentAt: new Date(),
        inReplyTo: originalEmail.messageId,
      },
    });

    res.status(201).json({
      id: replyEmail.id,
      status: 'sent',
      message: 'Reply sent successfully',
    });
  } catch (error: any) {
    logger.error('Reply email error:', error);
    res.status(500).json({
      error: 'Failed to send reply',
      details: error.message,
    });
  }
});

// Delete email
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.email.delete({
      where: { id },
    });

    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    logger.error('Delete email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Mark email as read/unread
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    await prisma.email.update({
      where: { id },
      data: { isRead: isRead !== undefined ? isRead : true },
    });

    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    logger.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

export default router;
