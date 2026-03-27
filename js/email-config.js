/* ============================================
   INSIGNIA — Email Configuration

   To enable automatic email sending:
   1. Create a free account at https://www.emailjs.com/
   2. Add your email service (Gmail, Outlook, etc.)
   3. Create a template with these variables:
      {{to_email}}, {{customer_name}}, {{temp_password}}, {{portal_url}}
   4. Fill in the values below
   ============================================ */

const EMAIL_CONFIG = {
  emailjsPublicKey:  '',   // Your EmailJS public key (Account > API Keys)
  emailjsServiceId:  '',   // e.g. 'service_gmail'
  emailjsTemplateId: '',   // e.g. 'template_portal_access'
  portalUrl:         '',   // Leave blank to auto-detect, or set e.g. 'https://insignia.ink/portal.html'
};
