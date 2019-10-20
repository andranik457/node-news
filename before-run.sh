#!/usr/bin/env bash
git reset --hard
git pull origin production
npm i
pm2 stop server.js
pm2 start server.js