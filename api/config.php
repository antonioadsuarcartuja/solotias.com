<?php
// api/config.php
session_start();

if (isset($_SESSION['user_llamametu_id']))
{

  setcookie('user_llamametu_id',$_SESSION['user_llamametu_id'],time() + (60*60*24*7),'/');
  $_COOKIE['user_llamametu_id']=$_SESSION['user_llamametu_id'];
}
elseif (isset($_COOKIE['user_llamametu_id']))
{
    $_SESSION['user_llamametu_id']=$_COOKIE['user_llamametu_id'];
}



define("PARSE_APP_ID", "IGHDCrWNI0qMCljZlB8wvs7TfiELgH99LIR1aYX0");
define("PARSE_REST_KEY", "QLJ7R07bWPn0mlqEtZEFzQAuWK2hgEeak9buQzn9");
define("PARSE_SERVER_URL", "https://parseapi.back4app.com/functions/");
