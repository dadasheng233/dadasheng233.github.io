@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not defined JAVA_HOME (
  if exist "C:\Program Files\Java\jdk-21\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-21"
  ) else if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
  ) else (
    for /d %%i in ("C:\Program Files\Java\jdk-*") do set "JAVA_HOME=%%i"
  )
)

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] JDK 17+ not found. Set JAVA_HOME to a JDK and try again.
  exit /b 1
)

echo Using JAVA_HOME=%JAVA_HOME%
echo Starting backend on http://127.0.0.1:8080 ...
call mvn -q spring-boot:run
