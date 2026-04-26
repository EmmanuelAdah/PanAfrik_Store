const { cloudinary } = require('../config/cloudinaryConfig');

const uploadImage = async (file) => {
    // Upload to Cloudinary if an image was provided
    if (file) {
        try {
            // Convert file buffer to base64
            const fileBase64 = file.buffer.toString('base64');
            const fileUri = `data:${file.mimetype};base64,${fileBase64}`;

            const uploadRes = await cloudinary.uploader.upload(fileUri, {
                folder: 'panafric_products',
                resource_type: 'image'
            });

            return  uploadRes.secure_url;
        } catch (uploadErr) {
            logger.error("Cloudinary Upload Error", { error: uploadErr.message });
            return res.status(500).json({ error: "Image upload failed." });
        }
    }
}

module.exports = uploadImage;