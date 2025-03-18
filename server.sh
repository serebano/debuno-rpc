#!/bin/sh
server=file://$(dirname $(realpath $0))/server.ts

# path="${1:-.}"

IFS=":" read -r path port <<< "$1"
path="${path:-.}"  # Default path is current directory if not provided
port="${port:-8080}"  # Default port 8080 if not provided

opts="${2}"

watch=""
if [[ "$opts" == 'w' ]]; then 
    watch="--watch" 
fi

path=$(realpath $path)
configFile=$path/deno.json
configArg=""

if [ -f $configFile ]; then
    configArg="-c=$configFile"
fi

echo "Starting RPC server with the following configuration"
echo ""
echo "  cwd:        $(pwd)"
echo "  server:     $server"
echo "  path:       $path"
echo "  port:       $port"
echo "  configArg:  $configArg"
echo ""

# echo "debuno deno --watch --no-clear-screen -c=$config $server $path $base"
debuno deno $watch $configArg $server $path:$port