const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

function uploadStream(buffer, folder = 'arun_thai', options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, ...options }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = { uploadStream };
