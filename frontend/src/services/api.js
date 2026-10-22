const API_BASE = '/api';

/**
 * Safely parses response body and handles non-JSON, empty, or error responses.
 * Completely eliminates "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 */
async function handleResponse(res, defaultErrorMsg = 'Request failed') {
  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new Error(
          text.length < 150 ? text : `Server error (HTTP ${res.status})`
        );
      }
    }
  }

  if (!res.ok) {
    const errorMsg =
      (data && (data.error || data.message)) ||
      `Server error (HTTP ${res.status}): ${defaultErrorMsg}`;
    throw new Error(errorMsg);
  }

  return data || {};
}

export const clientApi = {
  async getEvent(slug) {
    const res = await fetch(`${API_BASE}/client/events/${slug}`);
    return handleResponse(res, 'Event not found');
  },

  async verifyPin(slug, pin) {
    const res = await fetch(`${API_BASE}/client/events/${slug}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return handleResponse(res, 'PIN verification failed');
  },

  async matchFace(slug, payload) {
    let options = { method: 'POST' };
    if (payload instanceof FormData) {
      options.body = payload;
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_BASE}/client/events/${slug}/match-face`, options);
    return handleResponse(res, 'Face recognition matching failed');
  },

  async downloadZip(slug, photoIds) {
    const res = await fetch(`${API_BASE}/client/events/${slug}/download-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let errorMsg = `Failed to download photos (HTTP ${res.status})`;
      try {
        const data = JSON.parse(text);
        if (data.error) errorMsg = data.error;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IppuClicks_Photos_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadSinglePhoto(slug, photoId) {
    window.location.href = `${API_BASE}/client/events/${slug}/photos/${photoId}/download`;
  },
};

export const adminApi = {
  getToken() {
    return localStorage.getItem('ippu_admin_token');
  },
  setToken(token) {
    localStorage.setItem('ippu_admin_token', token);
  },
  logout() {
    localStorage.removeItem('ippu_admin_token');
  },
  authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.getToken()}`,
    };
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res, 'Login failed');
    this.setToken(data.token);
    return data;
  },

  async getEvents() {
    const res = await fetch(`${API_BASE}/admin/events`, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    return handleResponse(res, 'Failed to fetch events');
  },

  async getEvent(id) {
    const res = await fetch(`${API_BASE}/admin/events/${id}`, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    return handleResponse(res, 'Failed to fetch event');
  },

  async createEvent(eventData) {
    const res = await fetch(`${API_BASE}/admin/events`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(eventData),
    });
    return handleResponse(res, 'Failed to create event');
  },

  async updateEvent(id, updates) {
    const res = await fetch(`${API_BASE}/admin/events/${id}`, {
      method: 'PUT',
      headers: this.authHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res, 'Failed to update event');
  },

  async toggleDownloads(id, allowDownloads) {
    const res = await fetch(`${API_BASE}/admin/events/${id}/toggle-downloads`, {
      method: 'PATCH',
      headers: this.authHeaders(),
      body: JSON.stringify({ allowDownloads }),
    });
    return handleResponse(res, 'Failed to toggle downloads');
  },

  async deleteEvent(id) {
    const res = await fetch(`${API_BASE}/admin/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    return handleResponse(res, 'Failed to delete event');
  },

  async uploadWatermark(id, payload) {
    let headers = { Authorization: `Bearer ${this.getToken()}` };
    let body;
    if (payload instanceof FormData) {
      body = payload;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    const res = await fetch(`${API_BASE}/admin/events/${id}/watermark`, {
      method: 'POST',
      headers,
      body,
    });
    return handleResponse(res, 'Failed to upload watermark');
  },

  async reapplyWatermark(id) {
    const res = await fetch(`${API_BASE}/admin/events/${id}/reapply-watermark`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    return handleResponse(res, 'Failed to reapply watermark');
  },

  async uploadPhotos(eventId, formData) {
    const res = await fetch(`${API_BASE}/admin/events/${eventId}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: formData,
    });
    return handleResponse(res, 'Photo upload failed');
  },

  async deletePhoto(photoId) {
    const res = await fetch(`${API_BASE}/admin/photos/${photoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    return handleResponse(res, 'Failed to delete photo');
  },

  async downloadBackup() {
    const res = await fetch(`${API_BASE}/admin/database/backup`, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to download backup');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IppuClicks_DB_Backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
