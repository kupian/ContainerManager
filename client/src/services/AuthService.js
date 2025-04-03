import axios from 'axios';

const AuthService = {
  // Verify if a user ID is authorized
  verifyUser: async (clientId) => {
    try {
      const response = await axios.post('/api/auth/verify', { client_id: clientId });
      return response.data;
    } catch (error) {
      console.error('Error verifying user:', error);
      return { valid: false, is_admin: false };
    }
  },

  // Admin login
  adminLogin: async (username, password) => {
    try {
      const response = await axios.post('/api/auth/admin/login', { 
        username, 
        password 
      }, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Admin logout
  adminLogout: async () => {
    try {
      const response = await axios.post('/api/auth/admin/logout', {}, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
};

export default AuthService;