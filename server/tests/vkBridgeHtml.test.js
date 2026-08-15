'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

test('VKWebAppInit is sent in index.html head before game.js', function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const headEnd = html.indexOf('</head>');
  const bridgeAt = html.indexOf('vk-bridge.min.js');
  const initAt = html.indexOf('VKWebAppInit');
  const gameAt = html.indexOf('js/game.js');
  assert.ok(headEnd > 0, 'head exists');
  assert.ok(bridgeAt >= 0, 'vk-bridge script is present');
  assert.ok(initAt >= 0, 'VKWebAppInit is present');
  assert.ok(bridgeAt < initAt, 'bridge loads before VKWebAppInit');
  assert.ok(initAt < headEnd, 'VKWebAppInit is in <head>');
  assert.ok(initAt < gameAt, 'VKWebAppInit runs before game.js');
});

test('frontend does not contain VK_APP_SECRET', function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(/VK_APP_SECRET\s*[:=]\s*['"][^'"]+/.test(html), false);
  const vkJs = fs.readFileSync(path.join(root, 'js', 'vk.js'), 'utf8');
  assert.equal(/VK_APP_SECRET\s*[:=]\s*['"][^'"]+/.test(vkJs), false);
});

test('local vk-bridge vendor file exists', function () {
  const vendor = path.join(root, 'js', 'vendor', 'vk-bridge.min.js');
  const text = fs.readFileSync(vendor, 'utf8');
  assert.ok(text.indexOf('window.vkBridge') >= 0);
  assert.ok(text.indexOf('VKWebAppInit') >= 0);
});
