#!/bin/sh
server=file://$(dirname $(realpath $0))/server.ts

# path="${1:-.}"

IFS=":" read -r path port <<< "$1"
path="${path:-.}"  # Default path is current directory if not provided
port="${port:-8080}"  # Default port 8080 if not provided


base="/"
watch="${2}"

_path=""
_config=""

if [ ! -d $path ]; then 
    mkdir $path;
    _path="(created)"
fi

if [[ "$base" != */ ]]; then 
    base="${base}/" 
fi

if [[ "$watch" == 'w' ]]; then 
    watch="--watch" 
fi

path=$(realpath $path)
srcDir=$path
config=$path/deno.json #  --import-map=$config

if [ ! -d $srcDir ]; then 
    mkdir $srcDir;
fi

if ! [ -f $config ]; then
  echo "{\"imports\": {}, \"lock\":false}" > $config
  _config="(created)"
fi

echo "export default (x: string = 'World') => { console.log('Hello ' + x); return 'Hello ' + x; }" > $srcDir/foo.ts
echo "import hello from './foo.ts'\n\nhello('im bar')" > $srcDir/bar.ts
echo "export function baz() { throw new Error('Not implemented') };\n\nbaz();" > $srcDir/baz.ts

# cd $path

echo "Starting server with the following configuration: $watch"
echo ""
echo "  cwd:        $(pwd)"
echo "  server:     $server"
echo "  path:       $path $_path"
echo "  port:       $port"
echo "  base:       $base"
echo "  config:     $config $_config"
echo ""

# debuno deno bar.ts
# echo "debuno deno --watch --no-clear-screen -c=$config $server $path $base"

debuno deno $watch -c=$config $server $path:$port $base