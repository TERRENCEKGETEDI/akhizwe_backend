const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

const supabase = createClient(
  'https://rkuzqajmxnatyulwoxzy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdXpxYWpteG5hdHl1bHdveHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODQ3NjcsImV4cCI6MjA4MjM2MDc2N30.vGNaNmfhVd8YvLIhHyr0vCeaM-qshoJnKqEsKv0gsjM'
);

class MediaValidationService {
  constructor() {
    this.validationRules = {
      video: {
        maxFileSize: 500 * 1024 * 1024, // 500MB
        minFileSize: 1024 * 1024, // 1MB
        allowedFormats: ['video/mp4', 'video/x-matroska', 'video/webm', 'video/avi'],
        minResolution: { width: 480, height: 360 },
        maxResolution: { width: 3840, height: 2160 }, // 4K
        minDuration: 1, // 1 second
        maxDuration: 3600, // 1 hour
        maxBitrate: 5000000 // 5 Mbps
      },
      audio: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        minFileSize: 100 * 1024, // 100KB
        allowedFormats: ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg'],
        minDuration: 1, // 1 second
        maxDuration: 1800, // 30 minutes
        maxBitrate: 320000 // 320 kbps
      },
      image: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        minFileSize: 1024, // 1KB
        allowedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        minResolution: { width: 100, height: 100 },
        maxResolution: { width: 8192, height: 8192 }, // 8K
        maxColors: 16777216 // 16.7M colors (24-bit)
      }
    };

    this.safetyKeywords = [
      'explicit', 'nsfw', 'violence', 'weapon', 'drug', 'illegal', 'adult',
      'porn', 'nude', 'naked', 'sex', 'gore', 'blood', 'kill', 'murder'
    ];

    this.qualityThresholds = {
      video: {
        low: { bitrate: 500000, resolution: 480 }, // 500kbps, 480p
        medium: { bitrate: 1500000, resolution: 720 }, // 1.5Mbps, 720p
        high: { bitrate: 3000000, resolution: 1080 } // 3Mbps, 1080p
      },
      audio: {
        low: { bitrate: 64000, sampleRate: 22050 }, // 64kbps
        medium: { bitrate: 128000, sampleRate: 44100 }, // 128kbps
        high: { bitrate: 256000, sampleRate: 44100 } // 256kbps
      }
    };
  }

  /**
   * Validate media file comprehensively
   * @param {Object} mediaData - Media data object
   * @param {Buffer} fileBuffer - File buffer for analysis
   * @param {string} filePath - File path in Supabase
   * @returns {Object} Validation results
   */
  async validateMedia(mediaData, fileBuffer = null, filePath = null) {
    const validationResults = {
      fileIntegrity: false,
      contentQuality: false,
      metadata: false,
      safety: false,
      technicalSpecs: false,
      details: {},
      score: 0,
      recommendations: []
    };

    try {
      // 1. File Integrity Check
      validationResults.fileIntegrity = await this.checkFileIntegrity(filePath);
      validationResults.details.integrity = {
        passed: validationResults.fileIntegrity,
        message: validationResults.fileIntegrity ? 'File is accessible and intact' : 'File integrity check failed'
      };

      // 2. Content Quality Assessment
      validationResults.contentQuality = await this.assessContentQuality(mediaData, fileBuffer);
      validationResults.details.quality = {
        passed: validationResults.contentQuality,
        message: validationResults.contentQuality ? 'Content quality meets standards' : 'Content quality below standards'
      };

      // 3. Metadata Validation
      validationResults.metadata = this.validateMetadata(mediaData);
      validationResults.details.metadata = {
        passed: validationResults.metadata,
        message: validationResults.metadata ? 'Metadata is complete and valid' : 'Metadata is incomplete or invalid'
      };

      // 4. Safety Check
      validationResults.safety = await this.performSafetyCheck(mediaData);
      validationResults.details.safety = {
        passed: validationResults.safety,
        message: validationResults.safety ? 'Content passes safety checks' : 'Content may contain inappropriate material'
      };

      // 5. Technical Specifications
      validationResults.technicalSpecs = await this.validateTechnicalSpecs(mediaData, fileBuffer);
      validationResults.details.technical = {
        passed: validationResults.technicalSpecs,
        message: validationResults.technicalSpecs ? 'Technical specifications meet requirements' : 'Technical specifications need improvement'
      };

      // Calculate overall score and recommendations
      const passedChecks = [
        validationResults.fileIntegrity,
        validationResults.contentQuality,
        validationResults.metadata,
        validationResults.safety,
        validationResults.technicalSpecs
      ].filter(Boolean).length;

      validationResults.score = (passedChecks / 5) * 100;
      validationResults.recommendations = this.generateRecommendations(validationResults);

      return validationResults;
    } catch (error) {
      console.error('Media validation error:', error);
      return {
        ...validationResults,
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Check file integrity by verifying accessibility
   * @param {string} filePath - File path in Supabase
   * @returns {boolean} Integrity status
   */
  async checkFileIntegrity(filePath) {
    if (!filePath) return false;

    try {
      const bucket = this.getBucketFromMediaType('video'); // Default, will be overridden
      const { data, error } = await supabase.storage
        .from(bucket)
        .list('', {
          search: path.basename(filePath)
        });

      if (error) return false;

      // Test file accessibility
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('File integrity check failed:', error);
      return false;
    }
  }

  /**
   * Assess content quality based on file size, duration, and other factors
   * @param {Object} mediaData - Media metadata
   * @param {Buffer} fileBuffer - File buffer for analysis
   * @returns {boolean} Quality assessment result
   */
  async assessContentQuality(mediaData, fileBuffer) {
    const mediaType = mediaData.media_type?.toLowerCase();
    const rules = this.validationRules[mediaType];

    if (!rules) return false;

    // Check file size against quality thresholds
    const fileSizeMB = (mediaData.file_size || 0) / (1024 * 1024);
    const qualityLevel = this.determineQualityLevel(mediaType, fileSizeMB, mediaData);

    return qualityLevel !== 'unacceptable';
  }

  /**
   * Validate metadata completeness and quality
   * @param {Object} mediaData - Media metadata
   * @returns {boolean} Metadata validation result
   */
  validateMetadata(mediaData) {
    const requiredFields = ['title', 'artist', 'media_type'];
    const optionalFields = ['description', 'category', 'release_date'];

    // Check required fields
    const hasRequiredFields = requiredFields.every(field => 
      mediaData[field] && mediaData[field].toString().trim().length > 0
    );

    // Check field quality
    const titleQuality = mediaData.title && mediaData.title.length >= 3 && mediaData.title.length <= 100;
    const artistQuality = mediaData.artist && mediaData.artist.length >= 2 && mediaData.artist.length <= 50;

    return hasRequiredFields && titleQuality && artistQuality;
  }

  /**
   * Perform safety checks on content
   * @param {Object} mediaData - Media metadata
   * @returns {boolean} Safety check result
   */
  async performSafetyCheck(mediaData) {
    const contentToCheck = [
      mediaData.title || '',
      mediaData.description || '',
      mediaData.artist || ''
    ].join(' ').toLowerCase();

    // Check for inappropriate keywords
    const hasInappropriateContent = this.safetyKeywords.some(keyword => 
      contentToCheck.includes(keyword)
    );

    // Additional checks could be added here (AI content moderation, etc.)
    return !hasInappropriateContent;
  }

  /**
   * Validate technical specifications
   * @param {Object} mediaData - Media metadata
   * @param {Buffer} fileBuffer - File buffer for analysis
   * @returns {boolean} Technical validation result
   */
  async validateTechnicalSpecs(mediaData, fileBuffer) {
    const mediaType = mediaData.media_type?.toLowerCase();
    const rules = this.validationRules[mediaType];

    if (!rules) return false;

    const fileSize = mediaData.file_size || 0;

    // Check file size constraints
    if (fileSize < rules.minFileSize || fileSize > rules.maxFileSize) {
      return false;
    }

    // Check file format (if mimetype is available)
    if (mediaData.mimetype && !rules.allowedFormats.includes(mediaData.mimetype)) {
      return false;
    }

    // Additional technical checks based on media type
    switch (mediaType) {
      case 'video':
        return this.validateVideoSpecs(mediaData, rules);
      case 'audio':
        return this.validateAudioSpecs(mediaData, rules);
      case 'image':
        return this.validateImageSpecs(mediaData, rules);
      default:
        return false;
    }
  }

  /**
   * Validate video-specific technical specifications
   */
  validateVideoSpecs(mediaData, rules) {
    // Check duration if available
    if (mediaData.duration) {
      if (mediaData.duration < rules.minDuration || mediaData.duration > rules.maxDuration) {
        return false;
      }
    }

    // Additional video-specific checks
    return true;
  }

  /**
   * Validate audio-specific technical specifications
   */
  validateAudioSpecs(mediaData, rules) {
    // Check duration if available
    if (mediaData.duration) {
      if (mediaData.duration < rules.minDuration || mediaData.duration > rules.maxDuration) {
        return false;
      }
    }

    // Additional audio-specific checks
    return true;
  }

  /**
   * Validate image-specific technical specifications
   */
  validateImageSpecs(mediaData, rules) {
    // Check resolution if available
    if (mediaData.width && mediaData.height) {
      if (mediaData.width < rules.minResolution.width || 
          mediaData.height < rules.minResolution.height ||
          mediaData.width > rules.maxResolution.width || 
          mediaData.height > rules.maxResolution.height) {
        return false;
      }
    }

    // Additional image-specific checks
    return true;
  }

  /**
   * Determine quality level based on media type and properties
   * @param {string} mediaType - Type of media
   * @param {number} fileSizeMB - File size in MB
   * @param {Object} mediaData - Media metadata
   * @returns {string} Quality level
   */
  determineQualityLevel(mediaType, fileSizeMB, mediaData) {
    const thresholds = this.qualityThresholds[mediaType];

    if (!thresholds) return 'unacceptable';

    // Simple heuristic based on file size and media type
    switch (mediaType) {
      case 'video':
        if (fileSizeMB > 100) return 'high';
        if (fileSizeMB > 20) return 'medium';
        if (fileSizeMB > 5) return 'low';
        return 'unacceptable';

      case 'audio':
        if (fileSizeMB > 10) return 'high';
        if (fileSizeMB > 3) return 'medium';
        if (fileSizeMB > 0.5) return 'low';
        return 'unacceptable';

      case 'image':
        if (fileSizeMB > 2) return 'high';
        if (fileSizeMB > 0.5) return 'medium';
        if (fileSizeMB > 0.1) return 'low';
        return 'unacceptable';

      default:
        return 'unacceptable';
    }
  }

  /**
   * Generate recommendations based on validation results
   * @param {Object} validationResults - Validation results
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(validationResults) {
    const recommendations = [];

    if (!validationResults.fileIntegrity) {
      recommendations.push('Re-upload the file to ensure it is not corrupted');
    }

    if (!validationResults.contentQuality) {
      recommendations.push('Improve content quality by increasing file size or resolution');
    }

    if (!validationResults.metadata) {
      recommendations.push('Complete all required metadata fields (title, artist, description)');
    }

    if (!validationResults.safety) {
      recommendations.push('Review content for inappropriate material and remove if necessary');
    }

    if (!validationResults.technicalSpecs) {
      recommendations.push('Ensure file meets technical requirements (size, format, duration)');
    }

    if (validationResults.score < 60) {
      recommendations.push('Content needs significant improvements before approval');
    } else if (validationResults.score < 80) {
      recommendations.push('Content has minor issues that should be addressed');
    }

    return recommendations;
  }

  /**
   * Get bucket name from media type
   * @param {string} mediaType - Media type
   * @returns {string} Bucket name
   */
  getBucketFromMediaType(mediaType) {
    const upperType = mediaType?.toUpperCase();
    if (upperType === 'VIDEO') return 'videos';
    if (upperType === 'MUSIC') return 'audio';
    if (upperType === 'IMAGE') return 'images';
    return 'videos';
  }

  /**
   * Batch validate multiple media items
   * @param {Array} mediaItems - Array of media items to validate
   * @returns {Object} Validation results for all items
   */
  async batchValidate(mediaItems) {
    const results = {};
    const batchSize = 5; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (media) => {
        try {
          const validation = await this.validateMedia(media);
          return { mediaId: media.media_id, validation };
        } catch (error) {
          return { 
            mediaId: media.media_id, 
            validation: { 
              error: error.message, 
              score: 0,
              fileIntegrity: false,
              contentQuality: false,
              metadata: false,
              safety: false,
              technicalSpecs: false
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        results[result.mediaId] = result.validation;
      });
    }

    return results;
  }
}

module.exports = MediaValidationService;