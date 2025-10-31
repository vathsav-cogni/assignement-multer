const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const File = require('./models/File');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

const storage = multer.memoryStorage();
const upload = multer({ storage });


// connect to MongoDB
mongoose.connect('mongodb://localhost:27017/myFileStorage', {

});

function getBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

//Function to determine duplicate file
async function checkDuplicate(buffer, filename) {
  const fileHash = getBufferHash(buffer);

  //Check if the content hash already exists
  const byHash = await File.findOne({ hash: fileHash });
  if (byHash) {
    return { duplicate: true, type: 'content', file: byHash, hash: fileHash };
  }

  //Check if filename exists
  const byName = await File.findOne({ filename });
  if (byName) {
  
    const existingHash = byName.hash || getBufferHash(byName.data);
    if (existingHash === fileHash) {

      return { duplicate: true, type: 'content', file: byName, hash: fileHash };
    }

    return { duplicate: false, type: 'name-conflict', existingFile: byName };
  }

  return { duplicate: false, type: 'new', hash: fileHash };
}

app.post('/upload', upload.single('myFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;

    const result = await checkDuplicate(fileBuffer, filename);

    if (result.duplicate) {
 
      return res.status(409).json({ message: 'Duplicate file/Content detected. Upload aborted.', existingFilename: result.file.filename });
    }

    if (result.type === 'name-conflict') {

      return res.status(409).json({ message: 'Filename already exists with different content. Rename file or choose overwrite.', existingFilename: result.existingFile.filename });
    }

    const file = new File({
      filename,
      contentType: req.file.mimetype,
      data: fileBuffer,
      hash: result.hash
    });

    await file.save();
    res.status(201).json({ message: `File uploaded successfully: ${file.filename}` });
  } catch (err) {
    res.status(500).json({ message: `File upload failed: ${err.message}` });
  }
});

app.get('/download/:filename', async (req, res) => {
  try {
    const file = await File.findOne({ filename: req.params.filename });

    if (!file) {
      return res.status(404).json({ message: 'File not found.' });
    }

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`
    });
    res.send(file.data);
  } catch (err) {
    res.status(500).json({ message: `File download failed: ${err.message}` });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));