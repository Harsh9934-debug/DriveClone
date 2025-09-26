const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sharedLinkSchema = new mongoose.Schema({
    // The file this shared link is for
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true
    },
    
    // The user who created this shared link
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Unique token for the URL
    token: {
        type: String,
        default: () => uuidv4(),
        unique: true,
        required: true
    },
    
    // Expiration date and time
    expiresAt: {
        type: Date,
        required: true
    },
    
    // Optional: make the link only usable once
    oneTimeUse: {
        type: Boolean,
        default: false
    },
    
    // Track number of times the link was accessed
    accessCount: {
        type: Number,
        default: 0
    },
    
    // Track the last time the link was accessed
    lastAccessedAt: {
        type: Date
    },
    
    // For soft deletion (future feature)
    isActive: {
        type: Boolean,
        default: true
    },
    
    // When the link was created
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add method to check if link has expired
sharedLinkSchema.methods.hasExpired = function() {
    return Date.now() > this.expiresAt;
};

// Check if link is valid (not expired, active, and respects one-time use)
sharedLinkSchema.methods.isValid = function() {
    if (!this.isActive) return false;
    if (this.hasExpired()) return false;
    if (this.oneTimeUse && this.accessCount > 0) return false;
    return true;
};

// Record an access to this link
sharedLinkSchema.methods.recordAccess = async function() {
    this.accessCount += 1;
    this.lastAccessedAt = Date.now();
    return this.save();
};

const SharedLink = mongoose.model('SharedLink', sharedLinkSchema);

module.exports = SharedLink;