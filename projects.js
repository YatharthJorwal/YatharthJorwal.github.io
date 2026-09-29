/* ============ SHARED PROJECT DATA ============
   Used by index.html, projects.html and (later) any project-related page.
   Add a new project here once — every page that lists projects updates automatically.
   featured:true -> shown in the homepage grid. cat: 'shop' | 'mockup' | 'own'. */

const PROJECTS = [
  { id:'ideserve', featured:true,  cat:'shop', kind:'E-commerce', name:'iDeserve Nutrition', glyph:'iD',
    url:'https://www.ideservenutrition.com/', host:'ideservenutrition.com',
    desc:'Performance nutrition store with goal-based product discovery, secure Razorpay checkout, customer accounts, a BMI calculator and an AI product concierge.',
    a:'#0d0d0b', b:'#2b2818', c:'#e3c04d' },
  { id:'manzil', featured:false, cat:'mockup', kind:'Travel & chauffeur', name:'Manzil Tours & Travels', glyph:'M',
    url:'https://yatharthjorwal.github.io/Mockup-manziltours/', host:'manziltours',
    desc:'Chauffeur-driven SUV bookings for Delhi NCR — fleet, routes and pricing laid out for a quick WhatsApp booking.',
    a:'#10275a', b:'#1e4aa8', c:'#ffd23f' },
  { id:'bhatti', featured:false, cat:'mockup', kind:'Restaurant', name:'Bhatti Pizza Co.', glyph:'B',
    url:'https://yatharthjorwal.github.io/Mockup-bhatti.co/', host:'bhatti.co',
    desc:'Wood-fired pizza menu and ordering for a Hauz Khas spot, built to get people from "hungry" to "ordered" fast.',
    a:'#7a1410', b:'#d9381e', c:'#ffd166' },
  { id:'kaagaz', featured:false, cat:'mockup', kind:'Retail', name:'Kaagaz Studio', glyph:'K',
    url:'https://yatharthjorwal.github.io/Mockup-kaagazstudio/', host:'kaagazstudio',
    desc:'Handmade stationery shop with a full product catalogue, store hours and location for walk-ins and WhatsApp orders.',
    a:'#f2e7d5', b:'#d8b48f', c:'#6b2f16' },
  { id:'echo', featured:false, cat:'own', kind:'Not a shop demo — this one\u2019s mine', name:'EchoBridge', glyph:'E',
    url:'https://echo-bridge.in/', host:'echo-bridge.in',
    desc:'An AI-powered digital wellness concept: echo-chamber detection, perspective balancing and a companion biometric ring. Built solo, with a working landing page and a demo sign-up and pricing flow.',
    a:'#1a1040', b:'#4b2fa8', c:'#5eead4' },
  { id:'terminal', featured:false, cat:'own', kind:'Me, but in a terminal', name:'Yatharth Webs Terminal', glyph:'>_',
    url:'https://yatharthwebs.site/terminal.html', host:'yatharthwebs.site/terminal',
    desc:'Me, as a terminal :) Type help, spin the commit roulette, play snake, or try sudo hire yatharth.',
    a:'#0a1626', b:'#12395a', c:'#22d3c5' },
  { id:'ginniplus', featured:true, cat:'shop', kind:'Hardware retailer', name:'Ginni Plus', glyph:'G',
    url:'https://www.ginniplus.com/', host:'ginniplus.com',
    desc:'Door handle and hardware dealer in Chawri Bazar, Delhi — full product catalogue across handles, knobs and fittings, showroom details and WhatsApp-first customer support.',
    a:'#1c1206', b:'#3d2a12', c:'#d4af37' },
  { id:'trishla', featured:true, cat:'shop', kind:'Jewellery e-commerce', name:'Trishla Gold', glyph:'T',
    url:'https://trishlagolddiamonds.netlify.app/', host:'trishlagolddiamonds.netlify.app',
    desc:'Fine gold jewellery store for a Hyderabad showroom — full catalogue with category browsing, product pages, a working bag/checkout flow with UPI, card and COD, and store/contact details.',
    a:'#1a1408', b:'#4a3a12', c:'#e8c766' }
];
const CAT_LABELS = { shop:'Live client sites', mockup:'Mockup templates', own:'My own build' };
const CAT_BLURB = {
  shop:   'Real businesses, live and taking orders or enquiries.',
  mockup: 'Sample builds made to show what\u2019s possible \u2014 not paid client work.',
  own:    'Products I\u2019m building for myself.'
};
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
