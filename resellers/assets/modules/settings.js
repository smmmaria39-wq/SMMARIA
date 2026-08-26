// ===============================================
// Reseller Settings Module
// ===============================================

import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

export default async function initSettings() {
 const profileForm = document.getElementById('profile-form');
 const brandingForm = document.getElementById('branding-form');
 
 try {
  const response = await api.getMyPanel();
  const panel = response.data || {};
  
  // Populate Profile Form
  if (profileForm) {
   profileForm.elements['username'].value = panel.info?.ownerUsername || '';
   profileForm.elements['email'].value = panel.info?.ownerEmail || '';
  }
  
  // Populate Branding Form
  if (brandingForm) {
   brandingForm.elements['panelName'].value = panel.info?.panelName || '';
   brandingForm.elements['logoUrl'].value = panel.branding?.logoUrl || '';
   brandingForm.elements['primaryColor'].value = panel.branding?.primaryColor || '#F5A623';
   brandingForm.elements['secondaryColor'].value = panel.branding?.secondaryColor || '#08164A';
  }
 } catch (error) {
  console.error('Settings load error:', error);
 }
 
 // Handle Branding Update
 if (brandingForm) {
  brandingForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   const data = {
    panelName: brandingForm.elements['panelName'].value,
    logoUrl: brandingForm.elements['logoUrl'].value,
    primaryColor: brandingForm.elements['primaryColor'].value,
    secondaryColor: brandingForm.elements['secondaryColor'].value
   };
   
   try {
    showToast('Updating branding...', 'info');
    await api.updatePanelBranding(data);
    showToast('Branding updated successfully!', 'success');
   } catch (error) {
    showToast('Failed to update branding', 'error');
   }
  });
 }
};