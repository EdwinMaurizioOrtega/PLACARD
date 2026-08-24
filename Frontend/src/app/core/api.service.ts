import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AuthResponse,
  BlockedUser,
  Category,
  Garment,
  GarmentImage,
  LikeReceived,
  MatchDetail,
  MatchInfo,
  Message,
  Page,
  Report,
  Review,
  Stats,
  Swipe,
  SwipeResult,
  User,
} from './models';

export const API_URL = environment.apiUrl;

type Dict = Record<string, string | number | boolean | null | undefined>;

function toParams(query: Dict): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---------- auth ----------
  register(body: Record<string, unknown>): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, body);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email, password });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${API_URL}/auth/me`);
  }

  // ---------- usuarios ----------
  listUsers(query: Dict = {}): Observable<Page<User>> {
    return this.http.get<Page<User>>(`${API_URL}/users`, { params: toParams(query) });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${API_URL}/users/${id}`);
  }

  updateUser(id: string, body: Record<string, unknown>): Observable<User> {
    return this.http.put<User>(`${API_URL}/users/${id}`, body);
  }

  deleteUser(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/users/${id}`);
  }

  setUserActive(id: string, isActive: boolean): Observable<User> {
    return this.http.patch<User>(`${API_URL}/users/${id}/active`, { is_active: isActive });
  }

  // ---------- categorias ----------
  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_URL}/categories`);
  }

  createCategory(body: Record<string, unknown>): Observable<Category> {
    return this.http.post<Category>(`${API_URL}/categories`, body);
  }

  updateCategory(id: string, body: Record<string, unknown>): Observable<Category> {
    return this.http.put<Category>(`${API_URL}/categories/${id}`, body);
  }

  deleteCategory(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/categories/${id}`);
  }

  // ---------- prendas ----------
  listGarments(query: Dict = {}): Observable<Page<Garment>> {
    return this.http.get<Page<Garment>>(`${API_URL}/garments`, { params: toParams(query) });
  }

  myGarments(): Observable<Garment[]> {
    return this.http.get<Garment[]>(`${API_URL}/garments/mine`);
  }

  feed(query: Dict = {}): Observable<Garment[]> {
    return this.http.get<Garment[]>(`${API_URL}/garments/feed`, { params: toParams(query) });
  }

  getGarment(id: string): Observable<Garment> {
    return this.http.get<Garment>(`${API_URL}/garments/${id}`);
  }

  createGarment(body: Record<string, unknown>): Observable<Garment> {
    return this.http.post<Garment>(`${API_URL}/garments`, body);
  }

  updateGarment(id: string, body: Record<string, unknown>): Observable<Garment> {
    return this.http.put<Garment>(`${API_URL}/garments/${id}`, body);
  }

  deleteGarment(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/garments/${id}`);
  }

  moderateGarment(id: string, isHidden: boolean): Observable<Garment> {
    return this.http.patch<Garment>(`${API_URL}/garments/${id}/moderate`, { is_hidden: isHidden });
  }

  addGarmentImage(id: string, url: string): Observable<GarmentImage> {
    return this.http.post<GarmentImage>(`${API_URL}/garments/${id}/images`, { url });
  }

  deleteGarmentImage(id: string, imageId: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/garments/${id}/images/${imageId}`);
  }

  // ---------- swipes ----------
  swipe(garmentId: string, direction: 'like' | 'pass' | 'super'): Observable<SwipeResult> {
    return this.http.post<SwipeResult>(`${API_URL}/swipes`, {
      garment_id: garmentId,
      direction,
    });
  }

  mySwipes(): Observable<Swipe[]> {
    return this.http.get<Swipe[]>(`${API_URL}/swipes`);
  }

  likesReceived(): Observable<LikeReceived[]> {
    return this.http.get<LikeReceived[]>(`${API_URL}/swipes/likes-received`);
  }

  deleteSwipe(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/swipes/${id}`);
  }

  // ---------- matches y chat ----------
  listMatches(): Observable<MatchInfo[]> {
    return this.http.get<MatchInfo[]>(`${API_URL}/matches`);
  }

  getMatch(id: string): Observable<MatchDetail> {
    return this.http.get<MatchDetail>(`${API_URL}/matches/${id}`);
  }

  updateMatchStatus(id: string, status: string): Observable<MatchInfo> {
    return this.http.patch<MatchInfo>(`${API_URL}/matches/${id}`, { status });
  }

  deleteMatch(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/matches/${id}`);
  }

  listMessages(matchId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${API_URL}/matches/${matchId}/messages`);
  }

  sendMessage(matchId: string, body: string): Observable<Message> {
    return this.http.post<Message>(`${API_URL}/matches/${matchId}/messages`, { body });
  }

  markRead(matchId: string): Observable<unknown> {
    return this.http.post(`${API_URL}/matches/${matchId}/read`, {});
  }

  editMessage(id: string, body: string): Observable<Message> {
    return this.http.put<Message>(`${API_URL}/messages/${id}`, { body });
  }

  deleteMessage(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/messages/${id}`);
  }

  // ---------- reputacion ----------
  reviewsForUser(userId: string): Observable<Review[]> {
    return this.http.get<Review[]>(`${API_URL}/reviews/user/${userId}`);
  }

  myReviews(): Observable<Review[]> {
    return this.http.get<Review[]>(`${API_URL}/reviews`);
  }

  createReview(body: Record<string, unknown>): Observable<Review> {
    return this.http.post<Review>(`${API_URL}/reviews`, body);
  }

  updateReview(id: string, body: Record<string, unknown>): Observable<Review> {
    return this.http.put<Review>(`${API_URL}/reviews/${id}`, body);
  }

  deleteReview(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/reviews/${id}`);
  }

  // ---------- moderacion ----------
  createReport(body: Record<string, unknown>): Observable<Report> {
    return this.http.post<Report>(`${API_URL}/reports`, body);
  }

  listReports(status?: string): Observable<Report[]> {
    return this.http.get<Report[]>(`${API_URL}/reports`, { params: toParams({ status }) });
  }

  resolveReport(id: string, status: string, resolution?: string): Observable<Report> {
    return this.http.patch<Report>(`${API_URL}/reports/${id}`, { status, resolution });
  }

  listBlocks(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(`${API_URL}/blocks`);
  }

  blockUser(userId: string): Observable<unknown> {
    return this.http.post(`${API_URL}/blocks`, { user_id: userId });
  }

  unblockUser(userId: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/blocks/${userId}`);
  }

  // ---------- estadisticas ----------
  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${API_URL}/stats/overview`);
  }
}
