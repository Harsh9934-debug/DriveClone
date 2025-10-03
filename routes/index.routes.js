const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const FileModel = require('../models/file.model');
const SharedLinkModel = require('../models/sharedLink.model');
const { auth, requireAuth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

// Landing page
router.get('/', (req, res) => {
    res.render('index');
});

router.get('/home', auth, (req, res) => {
    if (!req.user) {
        return res.redirect('/user/login?message=Please login to upload files');
    }
    res.render('home');
});

// Route to display files page
router.get('/my-files', auth, (req, res) => {
    if (!req.user) {
        return res.redirect('/user/login?message=Please login to view your files');
    }
    res.render('files');
});

// Route to display public files page
router.get('/public-files', (req, res) => {
    res.render('public-files', { user: req.user || null });
});

// API route to get public files
router.get('/public-files-api', async (req, res) => {
    try {
        console.log('Fetching public files from database');
        const files = await FileModel.find({ isPublic: true })
            .populate('uploadedBy', 'name email')
            .sort({ uploadDate: -1 })
            .limit(50); // Limit to prevent overwhelming the page

        console.log(`Found ${files.length} public files`);
        if (files.length > 0) {
            console.log('First file details:', {
                name: files[0].originalName,
                isPublic: files[0].isPublic,
                hasUploadedBy: !!files[0].uploadedBy
            });
        }

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('Error fetching public files:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching public files: ' + error.message
        });
    }
});

// File upload route - REQUIRES authentication
router.post('/upload-file', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded' 
            });
        }

        // Create file record in database
        const fileRecord = new FileModel({
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedBy: req.user._id,
            isPublic: req.body.isPublic === 'on' || req.body.isPublic === true,
            description: req.body.description || ''
        });

        await fileRecord.save();

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                id: fileRecord._id,
                originalName: fileRecord.originalName,
                size: fileRecord.size,
                uploadDate: fileRecord.uploadDate,
                isPublic: fileRecord.isPublic
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up uploaded file if database save fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error uploading file: ' + error.message 
        });
    }
});

// Route to view uploaded files - REQUIRES authentication
router.get('/files', requireAuth, async (req, res) => {
    try {
        const files = await FileModel.find({ uploadedBy: req.user._id })
            .populate('uploadedBy', 'name email')
            .sort({ uploadDate: -1 });

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching files: ' + error.message
        });
    }
});

// Route to download file with privacy controls
router.get('/download/:id', auth, async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id).populate('uploadedBy', 'name');
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Check file privacy and ownership
        if (!file.isPublic) {
            // Private file - only owner can download
            if (!req.user || file.uploadedBy._id.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. This file is private.',
                    needsLogin: !req.user
                });
            }
        }

        // Check if file exists on disk
        if (!fs.existsSync(file.path)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on disk'
            });
        }

        // Increment download count
        file.downloadCount += 1;
        await file.save();

        // Send file
        res.download(file.path, file.originalName);

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error downloading file: ' + error.message
        });
    }
});

// Route to toggle file privacy
router.post('/toggle-privacy/:id', requireAuth, async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Check if user owns the file
        if (file.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only modify your own files.'
            });
        }

        // Toggle privacy
        file.isPublic = !file.isPublic;
        await file.save();

        res.json({
            success: true,
            message: `File is now ${file.isPublic ? 'public' : 'private'}`,
            isPublic: file.isPublic
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating file privacy: ' + error.message
        });
    }
});

// Create a shareable link with expiration time
router.post('/create-share-link/:fileId', 
    requireAuth, 
    [
        body('expiresIn').isInt({ min: 1, max: 30 }).withMessage('Expiration time must be between 1 and 30 days'),
        body('oneTimeUse').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.render('error', { 
                    message: 'Invalid share link parameters',
                    errors: errors.array(),
                    backUrl: '/my-files'
                });
            }

            // Find the file
            const file = await FileModel.findById(req.params.fileId);
            if (!file) {
                return res.render('error', { 
                    message: 'File not found', 
                    backUrl: '/my-files' 
                });
            }

            // Check ownership
            if (file.uploadedBy.toString() !== req.user._id.toString()) {
                return res.render('error', { 
                    message: 'You can only share your own files',
                    backUrl: '/my-files'
                });
            }

            // Calculate expiration date
            const expiresIn = parseInt(req.body.expiresIn);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresIn);

            // Create a new shared link
            const shareLink = new SharedLinkModel({
                fileId: file._id,
                createdBy: req.user._id,
                expiresAt: expiresAt,
                oneTimeUse: req.body.oneTimeUse === 'true' || req.body.oneTimeUse === true
            });

            await shareLink.save();

            // Generate the full URL
            const shareUrl = `${req.protocol}://${req.get('host')}/s/${shareLink.token}`;
            
            res.render('success', {
                message: 'Share link created successfully!',
                redirectUrl: '/my-files',
                redirectText: 'Back to My Files',
                showHome: true,
                additionalInfo: `Share link will expire on ${expiresAt.toLocaleString()}. ${shareLink.oneTimeUse ? 'This link can only be used once.' : ''}`
            });

        } catch (error) {
            console.error('Error creating share link:', error);
            res.render('error', {
                message: 'Error creating share link: ' + error.message,
                backUrl: '/my-files'
            });
        }
    }
);

// Get all share links for a file
router.get('/share-links/:fileId', requireAuth, async (req, res) => {
    try {
        // Find the file
        const file = await FileModel.findById(req.params.fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Check ownership
        if (file.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only view share links for your own files'
            });
        }

        // Get all active shared links for this file
        const shareLinks = await SharedLinkModel.find({
            fileId: file._id,
            isActive: true
        }).sort({ createdAt: -1 });

        // Format the links with full URLs
        const formattedLinks = shareLinks.map(link => {
            return {
                id: link._id,
                url: `${req.protocol}://${req.get('host')}/s/${link.token}`,
                expiresAt: link.expiresAt,
                oneTimeUse: link.oneTimeUse,
                accessCount: link.accessCount,
                lastAccessedAt: link.lastAccessedAt,
                hasExpired: link.hasExpired(),
                isValid: link.isValid()
            };
        });

        res.json({
            success: true,
            file: {
                id: file._id,
                name: file.originalName
            },
            shareLinks: formattedLinks
        });

    } catch (error) {
        console.error('Error fetching share links:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching share links: ' + error.message
        });
    }
});

// Revoke (deactivate) a share link
router.post('/revoke-share-link/:linkId', requireAuth, async (req, res) => {
    try {
        // Find the link
        const shareLink = await SharedLinkModel.findById(req.params.linkId)
            .populate('fileId');
        
        if (!shareLink) {
            return res.render('error', {
                message: 'Share link not found',
                backUrl: '/my-files'
            });
        }

        // Check ownership (of the file or the link)
        if (shareLink.createdBy.toString() !== req.user._id.toString()) {
            return res.render('error', {
                message: 'You can only revoke your own share links',
                backUrl: '/my-files'
            });
        }

        // Deactivate the link
        shareLink.isActive = false;
        await shareLink.save();

        res.render('success', {
            message: 'Share link has been revoked successfully',
            redirectUrl: '/my-files',
            redirectText: 'Back to My Files'
        });

    } catch (error) {
        console.error('Error revoking share link:', error);
        res.render('error', {
            message: 'Error revoking share link: ' + error.message,
            backUrl: '/my-files'
        });
    }
});

// Access a shared link
router.get('/s/:token', async (req, res) => {
    try {
        // Find the shared link by token
        const shareLink = await SharedLinkModel.findOne({ token: req.params.token })
            .populate({
                path: 'fileId',
                populate: {
                    path: 'uploadedBy',
                    select: 'name'
                }
            });

        // Check if link exists
        if (!shareLink) {
            return res.render('error', {
                message: 'Invalid or expired share link',
                backUrl: '/'
            });
        }

        // Check if link is valid
        if (!shareLink.isValid()) {
            let message = 'This share link has expired';
            
            if (shareLink.oneTimeUse && shareLink.accessCount > 0) {
                message = 'This share link has already been used';
            } else if (!shareLink.isActive) {
                message = 'This share link has been revoked';
            }
            
            return res.render('error', {
                message,
                backUrl: '/'
            });
        }

        // Check if the file exists
        const file = shareLink.fileId;
        if (!file) {
            return res.render('error', {
                message: 'The file associated with this link no longer exists',
                backUrl: '/'
            });
        }

        // Check if file exists on disk
        if (!fs.existsSync(file.path)) {
            return res.render('error', {
                message: 'File not found on server',
                backUrl: '/'
            });
        }

        // Render the shared file page
        res.render('shared-file', {
            shareLink,
            file,
            user: req.user || null
        });

    } catch (error) {
        console.error('Error accessing shared link:', error);
        res.render('error', {
            message: 'Error accessing shared link: ' + error.message,
            backUrl: '/'
        });
    }
});

// Download a file via shared link
router.get('/s/:token/download', async (req, res) => {
    try {
        // Find the shared link by token
        const shareLink = await SharedLinkModel.findOne({ token: req.params.token })
            .populate('fileId');

        // Check if link exists
        if (!shareLink) {
            return res.render('error', {
                message: 'Invalid or expired share link',
                backUrl: '/'
            });
        }

        // Check if link is valid
        if (!shareLink.isValid()) {
            let message = 'This share link has expired';
            
            if (shareLink.oneTimeUse && shareLink.accessCount > 0) {
                message = 'This share link has already been used';
            } else if (!shareLink.isActive) {
                message = 'This share link has been revoked';
            }
            
            return res.render('error', {
                message,
                backUrl: '/'
            });
        }

        // Check if the file exists
        const file = shareLink.fileId;
        if (!file) {
            return res.render('error', {
                message: 'The file associated with this link no longer exists',
                backUrl: '/'
            });
        }

        // Check if file exists on disk
        if (!fs.existsSync(file.path)) {
            return res.render('error', {
                message: 'File not found on server',
                backUrl: '/'
            });
        }

        // Record access to the link
        await shareLink.recordAccess();

        // Increment download count on the file
        file.downloadCount += 1;
        await file.save();

        // Send the file for download
        res.download(file.path, file.originalName);

    } catch (error) {
        console.error('Error downloading shared file:', error);
        res.render('error', {
            message: 'Error downloading shared file: ' + error.message,
            backUrl: '/'
        });
    }
});

module.exports = router;