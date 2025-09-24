const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    path: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Make optional if not always authenticated
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    isPublic: {
        type: Boolean,
        default: false // Private by default
    },
    description: {
        type: String,
        trim: true,
        default: ''
    }
});

const File = mongoose.model('File', fileSchema);

module.exports = File;