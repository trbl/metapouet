<?php
function startsWith($haystack, $needle)
{
    return (strncmp($haystack, $needle, strlen($needle)));
}

if(isset($_GET['url']))
{
	if(startsWith($_GET['url'], 'http%3A%2F%2Fpouet.net'))
	{
		//header('Access-Control-Allow-Origin: http://metapouet.net');
		$file = file_get_contents($_GET['url']);
		echo $file;
	}
}
?>