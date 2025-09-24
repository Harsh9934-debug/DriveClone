const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const FileModel = require('../models/file.model');
const { auth, requireAuth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

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
        const files = await FileModel.find({ isPublic: true })
            .populate('uploadedBy', 'name email')
            .sort({ uploadDate: -1 })
            .limit(50); // Limit to prevent overwhelming the page

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
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

module.exports = router;