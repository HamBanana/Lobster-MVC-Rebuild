REM tail.bat
REM
REM Usage: tail.bat <file> <number-of-lines> 
REM
REM Examples: tail.bat myfile.txt 10
REM           tail.bat "C:\My File\With\Spaces.txt" 10

@ECHO OFF
for /f "tokens=2-3 delims=:" %%f in ('find /c /v "" %1') do (
    for %%F in (%%f %%g) do set nbLines=%%F )
set /a nbSkippedLines=%nbLines%-%2
for /f "usebackq skip=%nbSkippedLines% delims=" %%d in (%1) do echo %%d