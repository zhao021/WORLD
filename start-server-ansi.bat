@echo off
echo Starting PHP server...
echo Server running at http://localhost:8000
echo Press Ctrl+C to stop the server

:: Start PHP server with UTF-8 encoding
php -S localhost:8000 -d default_charset=UTF-8

echo Server stopped
pause 