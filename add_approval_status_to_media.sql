-- Migration: Add approval_status field to media table
-- This replaces the boolean is_approved field with a proper status system

-- Add new approval_status column
ALTER TABLE media ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Add approval/rejection timestamp columns
ALTER TABLE media ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;
ALTER TABLE media ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP NULL;
ALTER TABLE media ADD COLUMN IF NOT EXISTS rejected_by_email VARCHAR(255) NULL;

-- Update existing media records based on current is_approved value
-- Media with is_approved = true becomes APPROVED
-- Media with is_approved = false stays as PENDING (assuming they were never explicitly rejected)

UPDATE media 
SET approval_status = 'APPROVED', 
    approved_at = COALESCE(updated_at, uploaded_at)
WHERE is_approved = true AND approval_status = 'PENDING';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_media_approval_status ON media(approval_status);
CREATE INDEX IF NOT EXISTS idx_media_approval_status_uploader ON media(approval_status, uploader_email);

-- Add comment to document the new status system
COMMENT ON COLUMN media.approval_status IS 'Media approval status: PENDING (awaiting review), APPROVED (approved by admin), REJECTED (rejected by admin)';
COMMENT ON COLUMN media.approved_at IS 'Timestamp when media was approved';
COMMENT ON COLUMN media.rejected_at IS 'Timestamp when media was rejected';
COMMENT ON COLUMN media.rejected_by_email IS 'Email of admin who rejected the media';

-- Migration completed successfully
SELECT 'Media table approval_status migration completed' as status;