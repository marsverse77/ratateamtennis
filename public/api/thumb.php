<?php
// Smaller copies of uploaded photos for places that show them small (avatars, cards, photo grids).
// GET thumb.php?w=400&p=sessions/abc.jpg -> the photo scaled so its shorter side is at most w px.
// Each size is made once and kept in uploads/thumbs/; browsers cache it for a year (upload names never change).

const THUMB_SIZES = [200, 400, 720];
const UPLOADS = __DIR__ . '/../uploads';

$w = (int) ($_GET['w'] ?? 0);
$p = (string) ($_GET['p'] ?? '');
if (!in_array($w, THUMB_SIZES, true) || !preg_match('#^(avatars|sessions|banners|blog|hero)/[\w.-]+\.(jpe?g|png|webp)$#', $p)) {
    http_response_code(400);
    exit;
}
$src = UPLOADS . '/' . $p;
if (!is_file($src)) {
    http_response_code(404);
    exit;
}
$webp = function_exists('imagewebp') && str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'image/webp');
$dest = UPLOADS . "/thumbs/$w/$p" . ($webp ? '.webp' : '.jpg');

if (!is_file($dest) || filemtime($dest) < filemtime($src)) {
    $img = function_exists('imagecreatefromstring') ? @imagecreatefromstring((string) file_get_contents($src)) : false;
    if (!$img) {
        // No image support on the server: fall back to the original.
        header('Location: ../uploads/' . $p, true, 302);
        exit;
    }
    [$sw, $sh] = [imagesx($img), imagesy($img)];
    $scale = min(1, $w / min($sw, $sh));
    $nw = max(1, (int) round($sw * $scale));
    $nh = max(1, (int) round($sh * $scale));
    $out = imagecreatetruecolor($nw, $nh);
    imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
    imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $sw, $sh);
    @mkdir(dirname($dest), 0755, true);
    $tmp = $dest . '.' . bin2hex(random_bytes(4));
    $ok = $webp ? imagewebp($out, $tmp, 72) : imagejpeg($out, $tmp, 76);
    if (!$ok || !@rename($tmp, $dest)) {
        @unlink($tmp);
        header('Location: ../uploads/' . $p, true, 302);
        exit;
    }
}

header('Content-Type: ' . ($webp ? 'image/webp' : 'image/jpeg'));
header('Content-Length: ' . filesize($dest));
header('Cache-Control: public, max-age=31536000, immutable');
header('Vary: Accept');
readfile($dest);
