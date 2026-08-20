@echo off
echo Compiling C++ DSA Engine...
g++ -std=c++17 src/main.cpp -o engine.exe
if %ERRORLEVEL% NEQ 0 (
    echo Compilation failed!
    exit /b %ERRORLEVEL%
)
echo Compilation successful. Created engine.exe
