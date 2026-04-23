import { showMessage } from "../../utils/utils.js";
import { navigate } from "../../routes/route_helpers.js";

export function initLocalGame2D(){
    const canvas = document.getElementById("pong-canvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const paddleW = 12;
    const paddleH = 90;
    const paddleSpeed = 6;
    const ballR = 7;
    const ballSpeed = 7;
    const winScore = 10;

    const left = { x: 20, y: H/2 - paddleH/2 };
    const right = { x: W - 20 - paddleW, y: H/2 - paddleH/2 };
    const ball = { x: W/2, y: H/2, vx: 0, vy: 0 };

    let scoreL = 0;
    let scoreR = 0;
    let started = false;
    let gameOver = false;
    let animId = null;
    const keys = {};

    const onKeyDown = (e) => {
        keys[e.key] = true;
        if (e.key === " " && !started && !gameOver){
            serveBall();
            started = true;
        }
    };
    const onKeyUp = (e) => keys[e.key] = false;

    function serveBall(){
        ball.x = W/2;
        ball.y = H/2;
        const angle = (Math.random() - 0.5) * 0.5;
        const dir = Math.random() < 0.5 ? 1 : -1;
        ball.vx = Math.cos(angle) * ballSpeed * dir;
        ball.vy = Math.sin(angle) * ballSpeed;
    }

    function update(){
        if (!started) return;

        if (keys["w"] || keys["W"]) left.y -= paddleSpeed;
        if (keys["s"] || keys["S"]) left.y += paddleSpeed;
        if (keys["ArrowUp"]) right.y -= paddleSpeed;
        if (keys["ArrowDown"]) right.y += paddleSpeed;

        left.y = Math.max(0, Math.min(H - paddleH, left.y));
        right.y = Math.max(0, Math.min(H - paddleH, right.y));

        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.y < ballR || ball.y > H - ballR){
            ball.vy = -ball.vy;
            ball.y = Math.max(ballR, Math.min(H - ballR, ball.y));
        }

        if (ball.vx < 0 &&
            ball.x - ballR < left.x + paddleW &&
            ball.x > left.x &&
            ball.y > left.y && ball.y < left.y + paddleH){
            ball.vx = -ball.vx;
            const hit = (ball.y - (left.y + paddleH/2)) / (paddleH/2);
            ball.vy = hit * ballSpeed * 0.75;
        }

        if (ball.vx > 0 &&
            ball.x + ballR > right.x &&
            ball.x < right.x + paddleW &&
            ball.y > right.y && ball.y < right.y + paddleH){
            ball.vx = -ball.vx;
            const hit = (ball.y - (right.y + paddleH/2)) / (paddleH/2);
            ball.vy = hit * ballSpeed * 0.75;
        }

        if (ball.x < 0){
            scoreR++;
            if (scoreR >= winScore) return endGame("Right player");
            resetRally();
        } else if (ball.x > W){
            scoreL++;
            if (scoreL >= winScore) return endGame("Left player");
            resetRally();
        }
    }

    function resetRally(){
        started = false;
        ball.x = W/2;
        ball.y = H/2;
        ball.vx = 0;
        ball.vy = 0;
    }

    function draw(){
        ctx.fillStyle = "#18181b";
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = "#3f3f46";
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(W/2, 0);
        ctx.lineTo(W/2, H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#8b5cf6";
        ctx.fillRect(left.x, left.y, paddleW, paddleH);
        ctx.fillRect(right.x, right.y, paddleW, paddleH);

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(scoreL.toString(), W/2 - 60, 60);
        ctx.fillText(scoreR.toString(), W/2 + 60, 60);

        if (!started && !gameOver){
            ctx.fillStyle = "#a78bfa";
            ctx.font = "24px sans-serif";
            ctx.fillText("Press SPACE to start", W/2, H/2 + 60);
        }
    }

    function loop(){
        if (gameOver) return;
        update();
        draw();
        animId = requestAnimationFrame(loop);
    }

    function cleanup(){
        gameOver = true;
        if (animId) cancelAnimationFrame(animId);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("popstate", cleanup);
        window.removeEventListener("beforeunload", cleanup);
        window.removeEventListener("pagehide", cleanup);
    }

    function endGame(winner){
        cleanup();
        showMessage(`${winner} wins!`);
        navigate("/pong");
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("popstate", cleanup);
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("pagehide", cleanup);

    animId = requestAnimationFrame(loop);
}
