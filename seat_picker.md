```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>상상 가득 자리 뽑기 🎲</title>
    <style>
        :root {
            --primary: #4a7c59;
            --primary-dark: #355a40;
            --accent: #ff8e53;
            --bg-color: #f4f7f6;
            --card-bg: #ffffff;
            --text-main: #2c3e50;
        }

        body {
            font-family: 'Pretendard', 'Malgun Gothic', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            max-width: 1000px;
            width: 100%;
            background: var(--card-bg);
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            box-sizing: border-box;
        }

        header {
            text-align: center;
            margin-bottom: 30px;
        }

        header h1 {
            color: var(--primary);
            margin: 0 0 10px 0;
            font-size: 2.2rem;
        }

        header p {
            color: #7f8c8d;
            margin: 0;
        }

        /* 설정 영역 */
        .setup-section {
            background: #f8f9fa;
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .setup-section h3 {
            margin-top: 0;
            color: var(--primary-dark);
        }

        textarea {
            width: 100%;
            height: 80px;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 1rem;
            resize: vertical;
            box-sizing: border-box;
            margin-bottom: 15px;
        }

        .btn-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        button {
            flex: 1;
            min-width: 150px;
            padding: 12px 20px;
            font-size: 1rem;
            font-weight: bold;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }

        .btn-save { background-color: #6c757d; color: white; }
        .btn-random { background-color: var(--primary); color: white; }
        .btn-roulette { background-color: var(--accent); color: white; }
        
        button:hover {
            transform: translateY(-2px);
            filter: brightness(0.9);
        }
        button:disabled {
            background-color: #ccc !important;
            cursor: not-allowed;
            transform: none;
        }

        /* 칠판 */
        .blackboard {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 12px;
            font-weight: bold;
            font-size: 1.2rem;
            border-radius: 6px;
            margin: 20px auto 40px auto;
            width: 60%;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            border: 4px solid #8e8d8a;
        }

        /* 자리 배치 격자 */
        .classroom-grid {
            display: grid;
            gap: 20px;
            justify-content: center;
            margin-top: 20px;
        }

        /* 자리 카드 스타일 */
        .seat {
            background: #ffffff;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            height: 90px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .seat .seat-num {
            font-size: 0.8rem;
            color: #a0aec0;
            margin-bottom: 5px;
        }

        /* 활성화/이펙트 스타일 */
        .seat.assigned {
            background: #edf2f7;
            border-color: #cbd5e1;
            animation: popIn 0.3s ease forwards;
        }

        .seat.blinking {
            background-color: #ffe066 !important;
            border-color: #fcc419 !important;
            transform: scale(1.05);
        }

        .seat.selected {
            background-color: #98e1af !important;
            border-color: var(--primary) !important;
            color: var(--primary-dark);
            animation: celebrate 0.5s ease;
        }

        /* 애니메이션 효과 */
        @keyframes popIn {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes celebrate {
            0% { transform: scale(1); }
            50% { transform: scale(1.15); background-color: #d4edda; }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>🎪 크리에이티브 자리 배치 시스템</h1>
        <p>명렬을 등록하고 원하는 방식으로 교실 자리를 재미있게 배치해보세요!</p>
    </header>

    <!-- 명렬 설정 -->
    <section class="setup-section">
        <h3>👥 학생 명렬 설정</h3>
        <textarea id="studentInput" placeholder="이름을 쉼표(,) 또는 줄바꿈으로 구분하여 입력해주세요.&#10;예: 김철수, 이영희, 박민수, 최수연..."></textarea>
        <div class="btn-group">
            <button class="btn-save" onclick="saveList()">명렬 저장하기</button>
            <button class="btn-random" id="btnRandom" onclick="arrangeRandom()">🎲 즉시 랜덤 배치</button>
            <button class="btn-roulette" id="btnRoulette" onclick="arrangeRoulette()">🎯 두근두근 룰렛 배치</button>
        </div>
    </section>

    <!-- 교실 전경 -->
    <div class="blackboard">🖥️ 앞 (칠판 / 스크린)</div>
    <div class="classroom-grid" id="classroomGrid"></div>
</div>

<script>
    // 기본 샘플 데이터
    const defaultStudents = "강하늘, 고은아, 김도현, 김민지, 박서준, 박지민, 백현우, 성시경, 신민아, 안은진, 오지호, 유재석, 윤아름, 이병헌, 이서진, 이지은, 장도연, 정우성, 조세호, 한효주";

    window.onload = function() {
        // 로컬스토리지에 저장된 명단이 있다면 로드, 없으면 기본값
        const savedData = localStorage.getItem('studentList');
        document.getElementById('studentInput').value = savedData ? savedData : defaultStudents;
        buildGrid();
    };

    function saveList() {
        const input = document.getElementById('studentInput').value;
        localStorage.setItem('studentList', input);
        alert('명렬이 브라우저에 성공적으로 저장되었습니다!');
        buildGrid();
    }

    // 입력 데이터를 가공하여 배열로 반환
    function getStudentList() {
        const input = document.getElementById('studentInput').value;
        return input.split(/[\n,]+/)
                    .map(name => name.trim())
                    .filter(name => name.length > 0);
    }

    // 학생 수에 맞게 미리 빈 격자(Grid) 배치 레이아웃 구성
    function buildGrid() {
        const students = getStudentList();
        const grid = document.getElementById('classroomGrid');
        grid.innerHTML = '';

        if(students.length === 0) return;

        // 인원수에 따른 동적 열(Column) 개수 계산 (4~6열 사이 유동적 배치)
        let cols = 4;
        if (students.length > 24) cols = 6;
        else if (students.length > 12) cols = 5;

        grid.style.gridTemplateColumns = `repeat(${cols}, 120px)`;

        // 빈 자리 구조 먼저 생성
        for(let i = 0; i < students.length; i++) {
            const seat = document.createElement('div');
            seat.classList.add('seat');
            seat.id = `seat-${i}`;
            seat.innerHTML = `<span class="seat-num">${i + 1}번 자리</span><div class="name">-</div>`;
            grid.appendChild(seat);
        }
    }

    // 배열 셔플 알고리즘 (Fisher-Yates)
    function shuffle(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // 1. 즉시 랜덤 배치
    function arrangeRandom() {
        let students = getStudentList();
        if(students.length === 0) return alert('학생 명렬을 입력해주세요!');
        
        buildGrid();
        students = shuffle(students);

        students.forEach((student, index) => {
            const seat = document.getElementById(`seat-${index}`);
            seat.classList.add('assigned');
            seat.querySelector('.name').innerText = student;
        });
    }

    // 2. 창의적인 룰렛 뽑기 애니메이션 배치
    function arrangeRoulette() {
        let students = getStudentList();
        if(students.length === 0) return alert('학생 명렬을 입력해주세요!');

        buildGrid();
        students = shuffle(students);

        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true); // 애니메이션 중 버튼 비활성화

        let currentSeatIndex = 0;

        // 순차적으로 자리를 채워나가는 재귀 함수
        function assignNextSeat() {
            if (currentSeatIndex >= students.length) {
                // 모든 배치가 끝나면 버튼 활성화
                buttons.forEach(btn => btn.disabled = false);
                return;
            }

            let targetSeat = document.getElementById(`seat-${currentSeatIndex}`);
            let blinkCount = 0;
            const totalBlinks = 10; // 룰렛이 도는 횟수
            const blinkSpeed = 60; // 도는 속도(ms)

            // 무작위 이름을 보여주며 빙글빙글 도는 효과 연출
            let rouletteInterval = setInterval(() => {
                targetSeat.classList.add('blinking');
                // 임의의 학생 이름 잠시 노출
                const randomTickerName = students[Math.floor(Math.random() * students.length)];
                targetSeat.querySelector('.name').innerText = randomTickerName;
                
                setTimeout(() => {
                    targetSeat.classList.remove('blinking');
                }, blinkSpeed - 10);

                blinkCount++;
                
                if (blinkCount >= totalBlinks) {
                    clearInterval(rouletteInterval);
                    
                    // 최종 확정 학생 배치
                    targetSeat.classList.add('selected');
                    targetSeat.querySelector('.name').innerText = students[currentSeatIndex];
                    
                    // 확정 후 약간의 딜레이를 두고 다음 자리로 이동
                    currentSeatIndex++;
                    setTimeout(assignNextSeat, 200);
                }
            }, blinkSpeed);
        }

        // 첫 번째 자리부터 순차 시작
        assignNextSeat();
    }
</script>

</body>
</html>