/* ============================
   utils.js
   ============================ */
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function randomChoice(array){return array[randomInt(0,array.length-1)]}
function randomUniqueIndices(count,max){if(count>max)throw new Error(`count(${count})>max(${max})`);const s=new Set;while(s.size<count)s.add(randomInt(0,max-1));return[...s]}
function deepCopy2D(grid){return grid.map(r=>[...r])}
function padZero(num,digits=3){return String(num).padStart(digits,'0')}
function debounce(func,delay){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>func.apply(this,args),delay)}}
function throttle(func,limit){let inThrottle;return(...args)=>{if(!inThrottle){func.apply(this,args);inThrottle=true;setTimeout(()=>inThrottle=false,limit)}}}
function isMobile(){return/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}
function addEventListener(el,event,handler,options={}){const passive=options.passive??true;el.addEventListener(event,handler,{passive,...options});return()=>el.removeEventListener(event,handler,{passive,...options})}
function createElement(tag,className,attributes={}){const el=document.createElement(tag);if(className){if(Array.isArray(className))el.classList.add(...className);else el.className=className}Object.entries(attributes).forEach(([k,v])=>el.setAttribute(k,v));return el}
const NEIGHBOR_OFFSETS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
window.MinesweeperUtils={randomInt,randomChoice,randomUniqueIndices,deepCopy2D,padZero,debounce,throttle,isMobile,addEventListener,createElement,NEIGHBOR_OFFSETS};

/* ============================
   stats.js
   ============================ */
const STORAGE_KEY='minesweeper_stats',MAX_RECORDS=1000;
function getGameRecords(){try{const data=localStorage.getItem(STORAGE_KEY);if(!data)return[];const records=JSON.parse(data);return Array.isArray(records)?records:[]}catch{return[]}}
function addGameRecord(difficulty,win,time){const records=getGameRecords();records.push({timestamp:Date.now(),difficulty,win,time});if(records.length>MAX_RECORDS)records.splice(0,records.length-MAX_RECORDS);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records))}catch{}}
function clearGameRecords(){localStorage.removeItem(STORAGE_KEY)}
function getStats(difficulty='all'){const records=getGameRecords();let filtered=difficulty==='all'?records:records.filter(r=>r.difficulty===difficulty);const total=filtered.length,wins=filtered.filter(r=>r.win).length,losses=total-wins,winRate=total>0?Math.round((wins/total)*100):0;let maxStreak=0,maxLosingStreak=0,tempStreak=0,tempLosingStreak=0;const sorted=[...filtered].sort((a,b)=>a.timestamp-b.timestamp);for(const r of sorted){if(r.win){tempStreak++;tempLosingStreak=0;if(tempStreak>maxStreak)maxStreak=tempStreak}else{tempLosingStreak++;tempStreak=0;if(tempLosingStreak>maxLosingStreak)maxLosingStreak=tempLosingStreak}}let currentStreak=0;if(sorted.length>0){let streak=0,isWin=null;for(let i=sorted.length-1;i>=0;i--){const win=sorted[i].win;if(isWin===null){isWin=win;streak=win?1:-1}else if(win===isWin)streak+=win?1:-1;else break}currentStreak=streak}const winRecords=filtered.filter(r=>r.win);let bestTime=0,totalTime=0;if(winRecords.length>0){bestTime=Math.min(...winRecords.map(r=>r.time));totalTime=winRecords.reduce((s,r)=>s+r.time,0)}const averageTime=winRecords.length>0?Math.round(totalTime/winRecords.length):0;return{total,wins,losses,winRate,currentStreak,maxStreak,maxLosingStreak,bestTime,averageTime}}
function getAllDifficultyStats(){const ds=['beginner','intermediate','expert','all'],res={};for(const d of ds)res[d]=getStats(d);return res}
function formatTime(seconds){const mins=Math.floor(seconds/60),secs=seconds%60;return`${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`}
function formatStreak(streak){if(streak>0)return`${streak} 连胜`;if(streak<0)return`${-streak} 连败`;return'无记录'}
window.MinesweeperStats={getGameRecords,addGameRecord,clearGameRecords,getStats,getAllDifficultyStats,formatTime,formatStreak};

/* ============================
   game.js (含增强求解器 + 智能提示)
   ============================ */
const DIFFICULTIES={beginner:{rows:9,cols:9,mines:10},intermediate:{rows:16,cols:16,mines:40},expert:{rows:16,cols:30,mines:99}};
const GameState={READY:'ready',PLAYING:'playing',WIN:'win',LOSE:'lose'};
const CellState={HIDDEN:'hidden',REVEALED:'revealed',FLAGGED:'flagged',QUESTION:'question'};
const CellType={EMPTY:'empty',NUMBER:'number',MINE:'mine'};

// ----- 增强求解器 -----
class MinesweeperSolver {
    static isSolvable(grid,rows,cols,startRow,startCol){
        const state=grid.map(row=>row.map(cell=>({type:cell.type,state:cell.state,neighborMines:cell.neighborMines,row:cell.row,col:cell.col})));
        if(state[startRow][startCol].type===CellType.MINE)return false;
        state[startRow][startCol].state=CellState.REVEALED;
        let revealedCount=1,totalSafe=rows*cols-this.countMines(state,rows,cols),changed=true,iter=0;
        while(changed&&revealedCount<totalSafe&&iter<rows*cols*2){
            changed=false;iter++;
            let r=this.applyInference(state,rows,cols);
            if(r.revealed>0){revealedCount+=r.revealed;changed=true}
            if(r.flagged>0)changed=true;
            if(!changed){r=this.applyAdvancedInference(state,rows,cols);if(r.revealed>0){revealedCount+=r.revealed;changed=true}if(r.flagged>0)changed=true}
            if(!changed){r=this.applyBruteForce(state,rows,cols);if(r.revealed>0){revealedCount+=r.revealed;changed=true}if(r.flagged>0)changed=true}
        }
        return revealedCount===totalSafe;
    }
    static countMines(grid,rows,cols){let c=0;for(let r=0;r<rows;r++)for(let c2=0;c2<cols;c2++)if(grid[r][c2].type===CellType.MINE)c++;return c}
    static applyInference(grid,rows,cols){let revealed=0,flagged=0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cell=grid[r][c];if(cell.state!==CellState.REVEALED||cell.type!==CellType.NUMBER)continue;const neighbors=this.getNeighbors(grid,rows,cols,r,c);const hidden=neighbors.filter(n=>n.state===CellState.HIDDEN);const flaggedNeighbors=neighbors.filter(n=>n.state===CellState.FLAGGED);const remaining=cell.neighborMines-flaggedNeighbors.length;if(hidden.length===remaining&&remaining>0){for(const n of hidden){if(n.state===CellState.HIDDEN&&n.type===CellType.MINE){n.state=CellState.FLAGGED;flagged++}}}if(remaining===0){for(const n of hidden){if(n.state===CellState.HIDDEN&&n.type!==CellType.MINE){n.state=CellState.REVEALED;revealed++}}}}return{revealed,flagged}}
    static applyAdvancedInference(grid,rows,cols){let revealed=0,flagged=0;const constraints=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cell=grid[r][c];if(cell.state!==CellState.REVEALED||cell.type!==CellType.NUMBER)continue;const neighbors=this.getNeighbors(grid,rows,cols,r,c);const hidden=neighbors.filter(n=>n.state===CellState.HIDDEN);const flaggedNeighbors=neighbors.filter(n=>n.state===CellState.FLAGGED);const remaining=cell.neighborMines-flaggedNeighbors.length;if(hidden.length>0&&remaining>=0)constraints.push({cells:hidden,mines:remaining})}for(let i=0;i<constraints.length;i++)for(let j=i+1;j<constraints.length;j++){const a=constraints[i],b=constraints[j];const aSet=new Set(a.cells.map(c=>`${c.row},${c.col}`)),bSet=new Set(b.cells.map(c=>`${c.row},${c.col}`));const intersection=a.cells.filter(c=>bSet.has(`${c.row},${c.col}`)),aOnly=a.cells.filter(c=>!bSet.has(`${c.row},${c.col}`)),bOnly=b.cells.filter(c=>!aSet.has(`${c.row},${c.col}`));if(aOnly.length>0&&intersection.length===b.cells.length){const aOnlyMines=a.mines-b.mines;if(aOnlyMines===0){for(const n of aOnly){if(n.state===CellState.HIDDEN&&n.type!==CellType.MINE){n.state=CellState.REVEALED;revealed++}}}else if(aOnlyMines===aOnly.length){for(const n of aOnly){if(n.state===CellState.HIDDEN&&n.type===CellType.MINE){n.state=CellState.FLAGGED;flagged++}}}}if(bOnly.length>0&&intersection.length===a.cells.length){const bOnlyMines=b.mines-a.mines;if(bOnlyMines===0){for(const n of bOnly){if(n.state===CellState.HIDDEN&&n.type!==CellType.MINE){n.state=CellState.REVEALED;revealed++}}}else if(bOnlyMines===bOnly.length){for(const n of bOnly){if(n.state===CellState.HIDDEN&&n.type===CellType.MINE){n.state=CellState.FLAGGED;flagged++}}}}}return{revealed,flagged}}
    static applyBruteForce(grid,rows,cols){const constraints=[];const cellMap=new Map,cellList=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cell=grid[r][c];if(cell.state!==CellState.REVEALED||cell.type!==CellType.NUMBER)continue;const neighbors=this.getNeighbors(grid,rows,cols,r,c);const hidden=neighbors.filter(n=>n.state===CellState.HIDDEN);const flaggedNeighbors=neighbors.filter(n=>n.state===CellState.FLAGGED);const remaining=cell.neighborMines-flaggedNeighbors.length;if(hidden.length>0&&remaining>=0){const involved=hidden.map(n=>{const key=`${n.row},${n.col}`;if(!cellMap.has(key)){cellMap.set(key,n);cellList.push(n)}return n});constraints.push({cells:involved,mines:remaining})}}if(cellList.length===0||cellList.length>30)return{revealed:0,flagged:0};const idxMap=new Map;cellList.forEach((cell,i)=>idxMap.set(`${cell.row},${cell.col}`,i));const masks=constraints.map(c=>{let mask=0n;for(const cell of c.cells){const idx=idxMap.get(`${cell.row},${cell.col}`);if(idx!==undefined)mask|=1n<<BigInt(idx)}return{mask,mines:c.mines}});const total=cellList.length;const solutions=[];const current=new Array(total).fill(false);function backtrack(pos){if(pos===total){for(const m of masks){let cnt=0,mm=m.mask,bit=0;while(mm>0n){if(mm&1n&&current[bit])cnt++;mm>>=1n;bit++}if(cnt!==m.mines)return}solutions.push([...current]);return}current[pos]=false;backtrack(pos+1);if(solutions.length>100)return;current[pos]=true;backtrack(pos+1)}backtrack(0);if(solutions.length===0)return{revealed:0,flagged:0};const mineCounts=new Array(total).fill(0);for(const sol of solutions)for(let i=0;i<total;i++)if(sol[i])mineCounts[i]++;let revealed=0,flagged=0;const totalSol=solutions.length;for(let i=0;i<total;i++){const cell=cellList[i];if(cell.state!==CellState.HIDDEN)continue;if(mineCounts[i]===totalSol){if(cell.type===CellType.MINE){cell.state=CellState.FLAGGED;flagged++}}else if(mineCounts[i]===0){if(cell.type!==CellType.MINE){cell.state=CellState.REVEALED;revealed++}}}return{revealed,flagged}}
    static getNeighbors(grid,rows,cols,row,col){const res=[];const offsets=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];for(const[dr,dc]of offsets){const nr=row+dr,nc=col+dc;if(nr>=0&&nr<rows&&nc>=0&&nc<cols)res.push(grid[nr][nc])}return res}
}

// ----- Game 类 -----
class Game {
    constructor(difficulty='intermediate'){
        this.difficulty=difficulty;
        this.config=DIFFICULTIES[difficulty];
        this.rows=this.config.rows;this.cols=this.config.cols;this.totalMines=this.config.mines;
        this.state=GameState.READY;
        this.grid=null;
        this.revealedCount=0;this.flaggedCount=0;this.minesRemaining=this.totalMines;
        this.hintsUsed=0;this.maxHints=3;
        this.startTime=null;this.timerInterval=null;this.elapsedSeconds=0;
        this.isFirstClick=true;this.noGuessMode=true;this._generationAttempts=0;
        this.handleCellClick=this.handleCellClick.bind(this);
        this.handleCellRightClick=this.handleCellRightClick.bind(this);
        this.handleReset=this.handleReset.bind(this);
        this.handleDifficultyChange=this.handleDifficultyChange.bind(this);
        this.handleHint=this.handleHint.bind(this);
        this.initGrid();
    }
    initGrid(){
        this.grid=[];
        for(let r=0;r<this.rows;r++){const row=[];for(let c=0;c<this.cols;c++)row.push({type:CellType.EMPTY,state:CellState.HIDDEN,neighborMines:0,row:r,col:c});this.grid.push(row)}
        this.revealedCount=0;this.flaggedCount=0;this.minesRemaining=this.totalMines;this.hintsUsed=0;this.elapsedSeconds=0;this.isFirstClick=true;this._generationAttempts=0;this.stopTimer();
    }
    placeMines(safeRow,safeCol){
        if(this.noGuessMode){const ok=this.generateNoGuessMap(safeRow,safeCol);if(!ok){console.warn('无猜生成失败，回退随机');this.placeMinesRandom(safeRow,safeCol)}}else this.placeMinesRandom(safeRow,safeCol);
        this.calculateNeighborMines();
    }
    generateNoGuessMap(safeRow,safeCol){const maxAttempts=200;for(let attempts=1;attempts<=maxAttempts;attempts++){this._generationAttempts=attempts;const gridCopy=[];for(let r=0;r<this.rows;r++){const row=[];for(let c=0;c<this.cols;c++)row.push({type:CellType.EMPTY,state:CellState.HIDDEN,neighborMines:0,row:r,col:c});gridCopy.push(row)}const safeCells=new Set;for(const[dr,dc]of NEIGHBOR_OFFSETS){const nr=safeRow+dr,nc=safeCol+dc;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.cols)safeCells.add(nr*this.cols+nc)}safeCells.add(safeRow*this.cols+safeCol);const total=this.rows*this.cols;const available=[];for(let i=0;i<total;i++)if(!safeCells.has(i))available.push(i);if(available.length<this.totalMines)continue;const shuffled=[...available];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}const mineIndices=shuffled.slice(0,this.totalMines);for(const idx of mineIndices){const r=Math.floor(idx/this.cols),c=idx%this.cols;gridCopy[r][c].type=CellType.MINE}for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){if(gridCopy[r][c].type===CellType.MINE)continue;let count=0;for(const[dr,dc]of NEIGHBOR_OFFSETS){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.cols&&gridCopy[nr][nc].type===CellType.MINE)count++}gridCopy[r][c].neighborMines=count;if(count>0)gridCopy[r][c].type=CellType.NUMBER}const solvable=MinesweeperSolver.isSolvable(gridCopy,this.rows,this.cols,safeRow,safeCol);if(solvable){this.grid=gridCopy;console.log(`✅ 无猜生成成功，尝试${attempts}次`);return true}if(attempts%50===0)console.log(`⏳ 无猜生成中...尝试${attempts}次`)}console.warn(`❌ 无猜生成失败，尝试${maxAttempts}次`);return false}
    placeMinesRandom(safeRow,safeCol){const safeCells=new Set;for(const[dr,dc]of NEIGHBOR_OFFSETS){const nr=safeRow+dr,nc=safeCol+dc;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.cols)safeCells.add(nr*this.cols+nc)}safeCells.add(safeRow*this.cols+safeCol);const total=this.rows*this.cols;let mineIndices=randomUniqueIndices(this.totalMines,total).filter(idx=>!safeCells.has(idx));while(mineIndices.length<this.totalMines){const idx=randomInt(0,total-1);if(!safeCells.has(idx)&&!mineIndices.includes(idx))mineIndices.push(idx)}for(const idx of mineIndices){const r=Math.floor(idx/this.cols),c=idx%this.cols;this.grid[r][c].type=CellType.MINE}}
    calculateNeighborMines(){for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){if(this.grid[r][c].type===CellType.MINE)continue;let count=0;for(const[dr,dc]of NEIGHBOR_OFFSETS){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.cols&&this.grid[nr][nc].type===CellType.MINE)count++}this.grid[r][c].neighborMines=count;if(count>0)this.grid[r][c].type=CellType.NUMBER}}
    startGame(){this.state=GameState.PLAYING;this.startTime=Date.now();this.startTimer();this.isFirstClick=false}
    startTimer(){this.stopTimer();this.timerInterval=setInterval(()=>{this.elapsedSeconds=Math.floor((Date.now()-this.startTime)/1000);this.onTimerUpdate?.(this.elapsedSeconds)},1000)}
    stopTimer(){if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null}}
    revealCell(row,col){const cell=this.grid[row][col];if(cell.state!==CellState.HIDDEN)return true;if(this.isFirstClick){this.placeMines(row,col);this.startGame()}if(cell.type===CellType.MINE){cell.state=CellState.REVEALED;this.revealedCount++;this.gameOver(false);return false}cell.state=CellState.REVEALED;this.revealedCount++;if(cell.neighborMines===0)this.revealNeighbors(row,col);this.checkWin();return true}
    revealNeighbors(row,col){const stack=[[row,col]],visited=new Set;visited.add(`${row},${col}`);while(stack.length){const[r,c]=stack.pop();for(const[dr,dc]of NEIGHBOR_OFFSETS){const nr=r+dr,nc=c+dc,key=`${nr},${nc}`;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.cols&&!visited.has(key)){visited.add(key);const cell=this.grid[nr][nc];if(cell.state===CellState.HIDDEN&&cell.type!==CellType.MINE){cell.state=CellState.REVEALED;this.revealedCount++;if(cell.neighborMines===0)stack.push([nr,nc])}}}}}
    toggleFlag(row,col){const cell=this.grid[row][col];if(cell.state===CellState.REVEALED)return;if(cell.state===CellState.HIDDEN){cell.state=CellState.FLAGGED;this.flaggedCount++;this.minesRemaining--}else if(cell.state===CellState.FLAGGED){cell.state=CellState.HIDDEN;this.flaggedCount--;this.minesRemaining++}this.onFlagUpdate?.(this.minesRemaining);this.checkWin()}
    checkWin(){const nonMine=this.rows*this.cols-this.totalMines;if(this.revealedCount===nonMine){this.gameOver(true);return true}let correct=0;for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){const cell=this.grid[r][c];if(cell.type===CellType.MINE&&cell.state===CellState.FLAGGED)correct++}if(correct===this.totalMines&&this.flaggedCount===this.totalMines){this.gameOver(true);return true}return false}
    gameOver(win){this.state=win?GameState.WIN:GameState.LOSE;this.stopTimer();if(!win){for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){const cell=this.grid[r][c];if(cell.type===CellType.MINE&&cell.state!==CellState.FLAGGED)cell.state=CellState.REVEALED}}addGameRecord(this.difficulty,win,this.elapsedSeconds);this.onGameOver?.(win,this.elapsedSeconds)}
    reset(){this.stopTimer();this.state=GameState.READY;this.initGrid();this.onReset?.()}
    changeDifficulty(diff){if(this.difficulty===diff)return;this.difficulty=diff;this.config=DIFFICULTIES[diff];this.rows=this.config.rows;this.cols=this.config.cols;this.totalMines=this.config.mines;this.reset()}

    // ----- 智能提示（改进版） -----
    getHint() {
        if (this.hintsUsed >= this.maxHints || this.state !== GameState.PLAYING) return null;
        const candidates = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.state === CellState.HIDDEN && cell.type !== CellType.MINE) {
                    candidates.push({ row: r, col: c });
                }
            }
        }
        if (candidates.length === 0) return null;
        let bestScore = -1, bestCandidates = [];
        for (const cand of candidates) {
            const { row, col } = cand;
            let adjRevealedNumbers = 0, adjHidden = 0;
            for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                const nr = row + dr, nc = col + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    const neighbor = this.grid[nr][nc];
                    if (neighbor.state === CellState.REVEALED && neighbor.type === CellType.NUMBER) adjRevealedNumbers++;
                    if (neighbor.state === CellState.HIDDEN) adjHidden++;
                }
            }
            let score = adjRevealedNumbers * 3 + adjHidden;
            if (adjRevealedNumbers === 0) score = 0;
            if (score > bestScore) { bestScore = score; bestCandidates = [cand]; }
            else if (score === bestScore) bestCandidates.push(cand);
        }
        let hint;
        if (bestCandidates.length === 0 || bestScore === 0) {
            hint = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
            hint = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
        }
        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);
        return hint;
    }

    // 回调
    onTimerUpdate=null;onFlagUpdate=null;onGameOver=null;onReset=null;onHintUpdate=null;onHintApplied=null;
    handleCellClick(row,col){if(this.state===GameState.WIN||this.state===GameState.LOSE)return;this.revealCell(row,col)}
    handleCellRightClick(row,col){if(this.state===GameState.WIN||this.state===GameState.LOSE)return;this.toggleFlag(row,col)}
    handleReset(){this.reset()}
    handleDifficultyChange(diff){this.changeDifficulty(diff)}
    handleHint(){const hint=this.getHint();if(hint)this.onHintApplied?.(hint.row,hint.col)}
}
window.MinesweeperGame={Game,DIFFICULTIES,GameState,CellState,CellType,MinesweeperSolver};

/* ============================
   ui.js
   ============================ */
class UI {
    constructor(){
        console.log('UI 构造函数开始');
        this.game=null;
        this.gridElement=document.getElementById('grid');
        this.minesCountElement=document.getElementById('mines-count');
        this.timerElement=document.getElementById('timer');
        this.gameStatusElement=document.getElementById('game-status');
        this.resetButton=document.getElementById('reset-btn');
        this.difficultySelect=document.getElementById('difficulty-select');
        this.hintButton=document.getElementById('hint-btn');
        this.hintCountElement=document.getElementById('hint-count');
        this.streakCounterElement=document.getElementById('streak-counter');
        this.streakIconElement=document.createElement('i');this.streakIconElement.classList.add('fas');
        const parent=this.streakCounterElement?.parentNode;if(parent)parent.appendChild(this.streakIconElement);
        this.statsDifficultyElement=document.getElementById('stats-difficulty');
        this.statsTotalElement=document.getElementById('stats-total');
        this.statsWinRateElement=document.getElementById('stats-win-rate');
        this.statsStreakElement=document.getElementById('stats-streak');
        this.statsMaxStreakElement=document.getElementById('stats-max-streak');
        this.statsMaxLosingStreakElement=document.getElementById('stats-max-losing-streak');
        this.statsBestTimeElement=document.getElementById('stats-best-time');
        this.statsAvgTimeElement=document.getElementById('stats-avg-time');
        this.statsResetButton=document.getElementById('stats-reset-btn');
        this.statsStreakSummaryElement=document.getElementById('stats-streak-summary');
        this.statsBestTimeSummaryElement=document.getElementById('stats-best-time-summary');
        this.statsToggleBtn=document.getElementById('stats-toggle-btn');
        this.statsDetailsElement=document.getElementById('stats-details');
        this._hintTimeout=null;this._hintedCell=null;
        this.init();
    }
    init(){
        const difficulty=this.difficultySelect.value;
        this.game=new Game(difficulty);
        this.game.onTimerUpdate=(s)=>this.updateTimer(s);
        this.game.onFlagUpdate=(m)=>this.updateMinesCount(m);
        this.game.onGameOver=(win,s)=>this.showGameOver(win,s);
        this.game.onReset=()=>this.resetUI();
        this.game.onHintUpdate=(used)=>this.updateHintCount(used);
        this.game.onHintApplied=(row,col)=>this.highlightHint(row,col);
        this.resetButton.addEventListener('click',()=>this.game.handleReset());
        this.difficultySelect.addEventListener('change',(e)=>{this.game.handleDifficultyChange(e.target.value);this.renderGrid();this.updateStatsDisplay()});
        this.hintButton.addEventListener('click',()=>this.game.handleHint());
        this.statsResetButton.addEventListener('click',()=>this.clearStats());
        this.statsToggleBtn.addEventListener('click',()=>this.toggleStatsDetails());
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.updateStatsDisplay();
        console.log('UI 初始化完成');
    }
    renderGrid(){
        this.gridElement.innerHTML='';
        this.gridElement.style.gridTemplateColumns=`repeat(${this.game.cols},1fr)`;
        this.gridElement.parentElement.className=`grid-wrapper difficulty-${this.game.difficulty}`;
        for(let r=0;r<this.game.rows;r++)for(let c=0;c<this.game.cols;c++){const cell=this.game.grid[r][c];const el=this.createCellElement(cell);this.gridElement.appendChild(el)}
    }
    createCellElement(cell){
        const el=createElement('div','cell');
        el.dataset.row=cell.row;el.dataset.col=cell.col;
        if(cell.state===CellState.REVEALED){el.classList.add('revealed');if(cell.type===CellType.MINE)el.classList.add('mine');else if(cell.type===CellType.NUMBER){el.classList.add(`number-${cell.neighborMines}`);el.textContent=cell.neighborMines||''}}else if(cell.state===CellState.FLAGGED)el.classList.add('flagged');
        el.addEventListener('click',(e)=>{e.preventDefault();this.handleCellClick(cell.row,cell.col,false)},{passive:false});
        el.addEventListener('contextmenu',(e)=>{e.preventDefault();this.handleCellClick(cell.row,cell.col,true)},{passive:false});
        el.addEventListener('touchstart',(e)=>{e.preventDefault();this.handleTouchStart(cell.row,cell.col,e)},{passive:false});
        return el;
    }
    handleCellClick(row,col,isRight){if(isRight)this.game.handleCellRightClick(row,col);else this.game.handleCellClick(row,col);this.renderGrid();this.updateGameStatus();if(this.game.state===GameState.WIN||this.game.state===GameState.LOSE)this.updateStatsDisplay()}
    handleTouchStart(row,col,event){const touch=event.touches[0];const start=Date.now();const timeout=setTimeout(()=>{this.game.handleCellRightClick(row,col);this.renderGrid();this.updateGameStatus();event.preventDefault()},500);const end=()=>{clearTimeout(timeout);if(Date.now()-start<500){this.game.handleCellClick(row,col);this.renderGrid();this.updateGameStatus()}document.removeEventListener('touchend',end);document.removeEventListener('touchmove',move)};const move=(e)=>{const ct=e.touches[0];const dx=ct.clientX-touch.clientX,dy=ct.clientY-touch.clientY;if(Math.sqrt(dx*dx+dy*dy)>10){clearTimeout(timeout);document.removeEventListener('touchend',end);document.removeEventListener('touchmove',move)}};document.addEventListener('touchend',end,{once:true});document.addEventListener('touchmove',move)}
    highlightHint(row,col){if(this._hintedCell)this._hintedCell.classList.remove('hinted');const el=this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);if(!el)return;el.classList.add('hinted');this._hintedCell=el;if(this._hintTimeout)clearTimeout(this._hintTimeout);this._hintTimeout=setTimeout(()=>{if(this._hintedCell){this._hintedCell.classList.remove('hinted');this._hintedCell=null}this._hintTimeout=null},3000);this.updateGameStatus(`💡 提示: 点击 (${row+1},${col+1}) 位置安全`)}
    updateGameStatus(msg){if(msg){this.gameStatusElement.textContent=msg;this.gameStatusElement.className='game-status';return}let message='',cls='';switch(this.game.state){case GameState.READY:message='点击格子开始游戏';break;case GameState.PLAYING:message='游戏中…';break;case GameState.WIN:message=`🎉 胜利！用时 ${this.game.elapsedSeconds} 秒`;cls='win';break;case GameState.LOSE:message='💥 游戏结束！踩到地雷了';cls='lose';break}this.gameStatusElement.textContent=message;this.gameStatusElement.className=`game-status ${cls}`;this.updateResetButtonFace()}
    updateResetButtonFace(){const icon=this.resetButton.querySelector('i');if(!icon)return;switch(this.game.state){case GameState.WIN:icon.className='fas fa-laugh-beam';break;case GameState.LOSE:icon.className='fas fa-dizzy';break;default:icon.className='fas fa-smile'}}
    updateMinesCount(c){this.minesCountElement.textContent=padZero(Math.max(0,c),3)}
    updateTimer(s){this.timerElement.textContent=padZero(s,3)}
    updateHintCount(used){const rem=this.game.maxHints-used;this.hintCountElement.textContent=rem;this.hintButton.disabled=rem<=0}
    showGameOver(win,s){this.renderGrid();this.updateGameStatus();this.hintButton.disabled=true;if(win)this.showConfetti();this.updateStatsDisplay()}
    resetUI(){this.updateMinesCount(this.game.minesRemaining);this.updateTimer(0);this.updateHintCount(0);this.renderGrid();this.updateGameStatus('点击格子开始游戏');this.hintButton.disabled=false;this.updateStatsDisplay()}
    showConfetti(){const colors=['#4a6fa5','#28a745','#dc3545','#ffc107','#17a2b8'];for(let i=0;i<100;i++){const c=createElement('div','confetti');c.style.cssText=`position:fixed;width:10px;height:10px;background-color:${colors[Math.floor(Math.random()*colors.length)]};border-radius:2px;top:-20px;left:${Math.random()*100}vw;animation:confetti-fall ${Math.random()*3+2}s linear forwards;z-index:9999`;document.body.appendChild(c);setTimeout(()=>c.remove(),5000)}if(!document.getElementById('confetti-style')){const style=createElement('style',null,{id:'confetti-style'});style.textContent='@keyframes confetti-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(360deg);opacity:0}}';document.head.appendChild(style)}}
    updateStatsDisplay(){
        const diff=this.game.difficulty,stats=getStats(diff);
        const names={beginner:'初级',intermediate:'中级',expert:'高级'};
        this.statsDifficultyElement.textContent=names[diff]||diff;
        this.statsTotalElement.textContent=stats.total;
        this.statsWinRateElement.textContent=`${stats.winRate}%`;
        this.statsStreakElement.textContent=formatStreak(stats.currentStreak);
        this.statsMaxStreakElement.textContent=stats.maxStreak;
        this.statsMaxLosingStreakElement.textContent=stats.maxLosingStreak;
        this.statsBestTimeElement.textContent=stats.bestTime>0?formatTime(stats.bestTime):'--:--';
        this.statsAvgTimeElement.textContent=stats.averageTime>0?formatTime(stats.averageTime):'--:--';
        this.statsStreakSummaryElement.textContent=formatStreak(stats.currentStreak);
        this.statsBestTimeSummaryElement.textContent=stats.bestTime>0?formatTime(stats.bestTime):'--:--';
        if(this.streakCounterElement){
            const abs=Math.abs(stats.currentStreak);
            this.streakCounterElement.textContent=abs;
            this.streakCounterElement.parentElement.classList.remove('positive','negative');
            const label=this.streakCounterElement.parentElement.querySelector('.counter-label');
            if(stats.currentStreak>0){this.streakCounterElement.parentElement.classList.add('positive');this.streakIconElement.className='fas fa-trophy';this.streakIconElement.style.opacity='1';if(label)label.textContent='连胜'}
            else if(stats.currentStreak<0){this.streakCounterElement.parentElement.classList.add('negative');this.streakIconElement.className='fas fa-thumbs-down';this.streakIconElement.style.opacity='1';if(label)label.textContent='连败'}
            else{this.streakIconElement.style.opacity='0';if(label)label.textContent='连胜/连败'}
        }
    }
    clearStats(){if(confirm('确定清空所有统计记录吗？')){clearGameRecords();this.updateStatsDisplay();alert('已清空')}}
    toggleStatsDetails(){const d=this.statsDetailsElement;if(d.style.display==='none'){d.style.display='block';this.statsToggleBtn.textContent='隐藏统计'}else{d.style.display='none';this.statsToggleBtn.textContent='详细统计'}}
}
document.addEventListener('DOMContentLoaded',()=>{new UI()});