param (
[string] $path = "",
[string] $lines = "10"
)

Get-Content $path -tail $lines