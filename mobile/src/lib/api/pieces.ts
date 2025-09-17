import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export interface Piece {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  category?: string;
  tags?: string[];
  source_link?: string;
  purchase_date?: string;
  price?: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePieceRequest {
  name: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  category?: string;
  tags?: string[];
  source_link?: string;
  purchase_date?: string;
  price?: number;
}

export interface UpdatePieceRequest {
  name?: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  category?: string;
  tags?: string[];
  source_link?: string;
  purchase_date?: string;
  price?: number;
}

export interface PiecesResponse {
  pieces: Piece[];
  total: number;
  limit: number;
  offset: number;
}

export interface CategoriesResponse {
  categories: string[];
}

class PiecesAPI {
  private getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getPieces(
    token: string,
    params: {
      limit?: number;
      offset?: number;
      search?: string;
      category?: string;
    } = {}
  ): Promise<PiecesResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/pieces`, {
        headers: this.getAuthHeaders(token),
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching pieces:', error);
      throw error;
    }
  }

  async getPiece(token: string, id: string): Promise<Piece> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/pieces/${id}`, {
        headers: this.getAuthHeaders(token),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching piece:', error);
      throw error;
    }
  }

  async createPiece(token: string, data: CreatePieceRequest): Promise<Piece> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/pieces`, data, {
        headers: this.getAuthHeaders(token),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating piece:', error);
      throw error;
    }
  }

  async updatePiece(token: string, id: string, data: UpdatePieceRequest): Promise<Piece> {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/v1/pieces/${id}`, data, {
        headers: this.getAuthHeaders(token),
      });
      return response.data;
    } catch (error) {
      console.error('Error updating piece:', error);
      throw error;
    }
  }

  async deletePiece(token: string, id: string): Promise<void> {
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/pieces/${id}`, {
        headers: this.getAuthHeaders(token),
      });
    } catch (error) {
      console.error('Error deleting piece:', error);
      throw error;
    }
  }

  async getCategories(token: string): Promise<CategoriesResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/pieces/categories`, {
        headers: this.getAuthHeaders(token),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }
}

export const piecesAPI = new PiecesAPI();
