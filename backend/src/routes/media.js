// src/routes/media.js
// Handles product image/video upload to Supabase Storage + CRUD

const router  = require('express').Router();
const auth    = require('../middleware/auth');
const supabase = require('../supabase');

const BUCKET = 'product-media';

// ── GET all product media ─────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product_media')
      .select('*')
      .order('product_name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET media for one product ─────────────────────────────────────────────────
router.get('/:productName', auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('product_media')
      .select('*')
      .eq('product_name', req.params.productName)
      .single();
    res.json(data || {});
  } catch {
    res.json({});
  }
});

// ── UPLOAD image or video for a product ──────────────────────────────────────
// Expects multipart/form-data with fields: productName, mediaType (image|video), file (base64 string), fileName, mimeType
router.post('/upload', auth, async (req, res) => {
  try {
    const { productName, mediaType, fileBase64, fileName, mimeType } = req.body;

    if (!productName || !mediaType || !fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(fileBase64, 'base64');

    // Build storage path
    const ext      = fileName.split('.').pop();
    const safeName = productName.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = `${safeName}/${mediaType}_${Date.now()}.${ext}`;

    // Delete old file if exists
    const { data: existing } = await supabase
      .from('product_media')
      .select('image_path, video_path')
      .eq('product_name', productName)
      .single();

    if (existing) {
      const oldPath = mediaType === 'image' ? existing.image_path : existing.video_path;
      if (oldPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4'),
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Save to product_media table
    const updateFields = mediaType === 'image'
      ? { image_url: publicUrl, image_path: filePath }
      : { video_url: publicUrl, video_path: filePath };

    const { data: saved, error: dbError } = await supabase
      .from('product_media')
      .upsert(
        { product_name: productName, ...updateFields, updated_at: new Date().toISOString() },
        { onConflict: 'product_name' }
      )
      .select()
      .single();

    if (dbError) throw dbError;

    res.json({ success: true, url: publicUrl, media: saved });

  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE image or video for a product ──────────────────────────────────────
router.delete('/:productName/:mediaType', auth, async (req, res) => {
  try {
    const { productName, mediaType } = req.params;

    const { data: existing } = await supabase
      .from('product_media')
      .select('*')
      .eq('product_name', productName)
      .single();

    if (!existing) return res.json({ success: true });

    // Remove from storage
    const filePath = mediaType === 'image' ? existing.image_path : existing.video_path;
    if (filePath) {
      await supabase.storage.from(BUCKET).remove([filePath]);
    }

    // Clear the field
    const clearFields = mediaType === 'image'
      ? { image_url: null, image_path: null }
      : { video_url: null, video_path: null };

    await supabase
      .from('product_media')
      .update({ ...clearFields, updated_at: new Date().toISOString() })
      .eq('product_name', productName);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
