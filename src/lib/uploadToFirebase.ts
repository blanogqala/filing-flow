import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const uploadFileToFirebase = async (file: File, userId: string): Promise<string> => {
  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const filename = `receipts/${userId}/${timestamp}_${file.name}`;
    
    // Create a reference to the file location
    const storageRef = ref(storage, filename);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file to Firebase Storage');
  }
};

export const uploadMultipleFiles = async (files: File[], userId: string): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadFileToFirebase(file, userId));
    const downloadURLs = await Promise.all(uploadPromises);
    return downloadURLs;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw new Error('Failed to upload files to Firebase Storage');
  }
};