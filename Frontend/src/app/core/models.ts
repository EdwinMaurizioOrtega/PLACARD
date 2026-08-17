export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  preferred_sizes: string[];
  preferred_styles: string[];
  max_distance_km: number;
  role: string;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  created_at: string;
}

export interface GarmentImage {
  id: string;
  garment_id: string;
  url: string;
  position: number;
  created_at: string;
}

export interface Garment {
  id: string;
  owner_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  color: string | null;
  style: string | null;
  size: string;
  condition: 'nuevo' | 'como_nuevo' | 'buen_estado' | 'usado';
  mode: 'venta' | 'intercambio' | 'ambos';
  status: 'disponible' | 'reservado' | 'cerrado';
  price: number | null;
  latitude: number | null;
  longitude: number | null;
  views: number;
  likes_count: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  owner_username: string;
  owner_full_name: string;
  owner_avatar_url: string | null;
  owner_rating: number;
  category_name: string | null;
  distance_km: number | null;
  images: GarmentImage[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface Swipe {
  id: string;
  user_id: string;
  garment_id: string;
  direction: 'like' | 'pass' | 'super';
  created_at: string;
}

export interface MatchInfo {
  id: string;
  user_a: string;
  user_b: string;
  garment_a: string | null;
  garment_b: string | null;
  status: 'activo' | 'cerrado' | 'cancelado';
  created_at: string;
  other_user_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_url: string | null;
  other_rating: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface MatchDetail extends MatchInfo {
  garments: Garment[];
}

export interface SwipeResult {
  swipe: Swipe;
  matched: boolean;
  match_info?: MatchInfo;
}

export interface LikeReceived {
  swipe_id: string;
  direction: string;
  created_at: string;
  garment_id: string;
  garment_title: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  match_id: string | null;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_username: string;
  reviewer_avatar_url: string | null;
}

export interface Stats {
  overview: {
    total_users: number;
    total_garments: number;
    available_garments: number;
    total_swipes: number;
    total_matches: number;
    total_messages: number;
    pending_reports: number;
  };
  by_category: { category: string; total: number }[];
  mine: {
    my_garments: number;
    my_likes_received: number;
    my_matches: number;
    unread_messages: number;
  };
}

export const CONDITIONS = [
  { value: 'nuevo', label: 'Nuevo con etiqueta' },
  { value: 'como_nuevo', label: 'Como nuevo' },
  { value: 'buen_estado', label: 'Buen estado' },
  { value: 'usado', label: 'Usado' },
] as const;

export const MODES = [
  { value: 'venta', label: 'Venta' },
  { value: 'intercambio', label: 'Intercambio' },
  { value: 'ambos', label: 'Venta o intercambio' },
] as const;

export const STATUSES = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'cerrado', label: 'Cerrado' },
] as const;

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'U', '36', '37', '38', '39', '40', '41', '42'];

export const STYLES = ['casual', 'formal', 'streetwear', 'deportivo', 'boho', 'vintage'];

export interface Report {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  target_garment_id: string | null;
  reason: string;
  details: string | null;
  status: 'pendiente' | 'revisado' | 'descartado';
  resolution: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter_username: string;
  target_username: string | null;
  target_garment_title: string | null;
}

export interface BlockedUser {
  blocked_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'fraude', label: 'Posible fraude o estafa' },
  { value: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { value: 'prenda_no_corresponde', label: 'La prenda no corresponde a la descripción' },
  { value: 'acoso', label: 'Acoso o mensajes ofensivos' },
  { value: 'otro', label: 'Otro motivo' },
] as const;
