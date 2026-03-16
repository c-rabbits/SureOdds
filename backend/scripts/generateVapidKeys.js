#!/usr/bin/env node
/**
 * VAPID Key Generator for Web Push Notifications.
 * Run once: node scripts/generateVapidKeys.js
 * Copy the output to your .env file.
 */

const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== VAPID Keys Generated ===');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@sureodds.com`);
console.log('\nAlso add VAPID_PUBLIC_KEY to frontend .env.local:');
console.log(`NEXT_PUBLIC_VAPID_KEY=${vapidKeys.publicKey}`);
