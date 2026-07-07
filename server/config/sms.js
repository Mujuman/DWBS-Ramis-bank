const axios = require('axios');
require('dotenv').config();

/**
 * Local SMS Gateway client using UCS2 encoding (data_coding=0x08)
 * for native Amharic text payloads.
 *
 * Configured for internal local SMS gateway API.
 * No external third-party cloud SMS vendor is used.
 */

/**
 * Sends an SMS message in Amharic (UCS2/UCS-2) encoding.
 * @param {string} to - Recipient phone number (E.164 format: +251...)
 * @param {string} message - Amharic or Latin text message
 */
const sendSMS = async (to, message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[SMS] Dev mode — SMS not sent. To:', to.slice(0, 4) + '****');
    return { status: 'mocked', to: '****', message: '[MASKED]' };
  }

  const payload = {
    to,
    message,
    sender_id: process.env.SMS_SENDER_ID || 'RammisBank',
    data_coding: '0x08', // UCS2 encoding for Amharic script
    api_key: process.env.SMS_GATEWAY_API_KEY,
  };

  const response = await axios.post(
    process.env.SMS_GATEWAY_URL,
    payload,
    {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data;
};

module.exports = { sendSMS };
