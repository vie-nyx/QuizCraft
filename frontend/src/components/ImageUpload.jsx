import { useState } from 'react';
import axios from 'axios';

const ImageUploader = () => {
  const [entries, setEntries] = useState([{ id: '', image: null }]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddEntry = () => {
    setEntries([...entries, { id: '', image: null }]);
  };

  const handleIdChange = (index, value) => {
    const newEntries = [...entries];
    newEntries[index].id = value;
    setEntries(newEntries);
  };

  const handleImageChange = (index, file) => {
    const newEntries = [...entries];
    newEntries[index].image = file;
    setEntries(newEntries);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const uploadPromises = entries.map(async (entry) => {
        if (!entry.id || !entry.image) {
          throw new Error('All entries must have both ID and image');
        }

        const formData = new FormData();
        formData.append('id', entry.id);
        formData.append('image', entry.image);

        return axios.post('/image-upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      });

      await Promise.all(uploadPromises);
      setMessage('All images uploaded successfully!');
      setEntries([{ id: '', image: null }]); // Reset form
    } catch (error) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-uploader">
      <h2>Image Upload</h2>
      
      {entries.map((entry, index) => (
        <div key={index} className="upload-entry">
          <input
            type="text"
            placeholder="Enter ID"
            value={entry.id}
            onChange={(e) => handleIdChange(index, e.target.value)}
          />
          
          <label className="file-input">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(index, e.target.files[0])}
            />
            {entry.image ? entry.image.name : 'Choose Image'}
          </label>

          {entry.image && (
            <img 
              src={URL.createObjectURL(entry.image)} 
              alt="Preview" 
              className="image-preview"
            />
          )}
        </div>
      ))}

      <div className="controls">
        <button 
          type="button" 
          onClick={handleAddEntry}
          className="add-button"
        >
          Add More +
        </button>

        <button 
          type="button" 
          onClick={handleSubmit} 
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Uploading...' : 'Upload All'}
        </button>
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
};

export default ImageUploader;