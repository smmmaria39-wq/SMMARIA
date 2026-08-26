// ===============================================
// Reseller Announcements Module
// ===============================================

import { api } from '../utils/api.js';
import { formatDate } from '../utils/formatter.js';

let showToast = (msg, type) => alert((type === 'error' ? 'Error: ' : '') + msg);
try {
 const toastMod = await import('../components/toast.js');
 if (toastMod.showToast) showToast = toastMod.showToast;
} catch (e) {}

export default async function initAnnouncements() {
 const tbody = document.getElementById('announcementsTableBody');
 const newAnnBtn = document.querySelector('[data-modal-target="#createAnnouncementModal"]');
 const modal = document.getElementById('createAnnouncementModal');
 const closeBtn = document.querySelector('#createAnnouncementModal .modal__close');
 
 // Manual Modal Toggle (Failsafe)
 if (newAnnBtn && modal) {
  newAnnBtn.addEventListener('click', () => {
   modal.classList.add('active');
   document.body.style.overflow = 'hidden';
  });
 }
 if (closeBtn && modal) {
  closeBtn.addEventListener('click', () => {
   modal.classList.remove('active');
   document.body.style.overflow = '';
  });
 }
 
 if (tbody) await fetchAnnouncements();
 
 const form = document.getElementById('createAnnouncementForm');
 if (form) {
  form.addEventListener('submit', async (e) => {
   e.preventDefault();
   const title = document.getElementById('annTitle').value;
   const message = document.getElementById('annMessage').value;
   
   try {
    showToast('Creating...', 'info');
    await api.createPanelAnnouncement({ title, message });
    showToast('Announcement published!', 'success');
    
    if (modal) {
     modal.classList.remove('active');
     document.body.style.overflow = '';
    }
    form.reset();
    
    await fetchAnnouncements();
   } catch (error) {
    showToast(error.message || 'Failed to create announcement', 'error');
   }
  });
 }
}

async function fetchAnnouncements() {
 const tbody = document.getElementById('announcementsTableBody');
 try {
  const response = await api.getPanelAnnouncements();
  const anns = response.data || [];
  
  if (anns.length === 0) {
   tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No announcements posted yet.</td></tr>`;
   return;
  }
  
  tbody.innerHTML = anns.map(ann => `
      <tr>
        <td><strong>${ann.title}</strong></td>
        <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ann.message}</td>
        <td>${formatDate(ann.createdAt)}</td>
        <td>
          <button class="btn btn--danger btn--sm" onclick="deleteAnnouncement('${ann.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
 } catch (error) {
  tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load announcements.</td></tr>`;
 }
}

window.deleteAnnouncement = async (id) => {
 if (!confirm('Are you sure you want to delete this announcement?')) return;
 try {
  await api.deletePanelAnnouncement(id);
  showToast('Announcement deleted!', 'success');
  await fetchAnnouncements();
 } catch (error) {
  showToast('Failed to delete', 'error');
 }
};