  return (
    <div className="w-full h-full flex flex-col bg-[#1C120C] relative overflow-hidden select-none">
      {/* Subtle woven pattern background overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #F59E0B 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* Top Bar: Score & Turn Indicator */}
      <div className="absolute top-0 inset-x-0 z-40 flex justify-between items-center text-white/90 text-xs p-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Alama seed={mySeed || sessionId} size={36} />
            {state.turn === sessionId && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1C120C] bg-amber-500 animate-pulse" />
            )}
          </div>
          <div>
            <span className={"font-bold text-sm " + (state.turn === sessionId ? 'text-amber-400' : 'text-white/70')}>
              {myHandle}
            </span>
            <div className="text-[10px] text-white/60">You</div>
          </div>
        </div>

        <div className="flex flex-col items-center bg-black/50 px-4 py-1.5 rounded-xl border border-amber-900/50 backdrop-blur-sm">
          <span className="text-[0.65rem] text-amber-500/70 uppercase tracking-widest mb-0.5">Score</span>
          <div className="flex gap-4 font-mono font-bold text-sm">
            <span className="text-green-500">{wins}W</span>
            <span className="text-red-500">{losses}L</span>
          </div>
        </div>
      </div>

      {/* --- THE MAT: Opponent Seats --- */}
      
      {/* Opponent 1: Top Center */}
      {opponents[0] && (
        <div className={"absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center transition-all " + (state.turn === opponents[0] ? 'scale-110' : 'scale-100 opacity-90')}>
          <div className={"relative rounded-2xl px-4 py-2 flex flex-col items-center gap-1 border " + (state.turn === opponents[0] ? 'bg-amber-900/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10')}>
            <Alama seed={opponents[0]} size={40} />
            <span className={"text-[12px] font-bold truncate max-w-[90px] " + (state.turn === opponents[0] ? 'text-amber-400' : 'text-white/80')}>
              {nameOf(opponents[0])}
            </span>
            <div className="flex -space-x-3 mt-1">
              {Array.from({ length: Math.min(state.hands[opponents[0]]?.length || 0, 5) }).map((_, i) => (
                <CardBack key={i} />
              ))}
            </div>
            <span className="text-[10px] text-white/50">{state.hands[opponents[0]]?.length || 0} cards</span>
          </div>
        </div>
      )}

      {/* Opponent 2: Left Side */}
      {opponents[1] && (
        <div className={"absolute left-3 top-[45%] -translate-y-1/2 z-30 flex flex-col items-center transition-all " + (state.turn === opponents[1] ? 'scale-110' : 'scale-100 opacity-90')}>
          <div className={"relative rounded-2xl px-2 py-3 flex flex-col items-center gap-1 border " + (state.turn === opponents[1] ? 'bg-amber-900/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10')}>
            <Alama seed={opponents[1]} size={32} />
            <span className={"text-[10px] font-bold truncate max-w-[60px] " + (state.turn === opponents[1] ? 'text-amber-400' : 'text-white/80')}>
              {nameOf(opponents[1])}
            </span>
            <div className="flex flex-col -space-y-3 mt-1">
              {Array.from({ length: Math.min(state.hands[opponents[1]]?.length || 0, 3) }).map((_, i) => (
                <div key={i} className="rotate-90 scale-75"><CardBack /></div>
              ))}
            </div>
            <span className="text-[10px] text-white/50">{state.hands[opponents[1]]?.length || 0}</span>
          </div>
        </div>
      )}

      {/* Opponent 3: Right Side */}
      {opponents[2] && (
        <div className={"absolute right-3 top-[45%] -translate-y-1/2 z-30 flex flex-col items-center transition-all " + (state.turn === opponents[2] ? 'scale-110' : 'scale-100 opacity-90')}>
          <div className={"relative rounded-2xl px-2 py-3 flex flex-col items-center gap-1 border " + (state.turn === opponents[2] ? 'bg-amber-900/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10')}>
            <Alama seed={opponents[2]} size={32} />
            <span className={"text-[10px] font-bold truncate max-w-[60px] " + (state.turn === opponents[2] ? 'text-amber-400' : 'text-white/80')}>
              {nameOf(opponents[2])}
            </span>
            <div className="flex flex-col -space-y-3 mt-1">
              {Array.from({ length: Math.min(state.hands[opponents[2]]?.length || 0, 3) }).map((_, i) => (
                <div key={i} className="-rotate-90 scale-75"><CardBack /></div>
              ))}
            </div>
            <span className="text-[10px] text-white/50">{state.hands[opponents[2]]?.length || 0}</span>
          </div>
        </div>
      )}

      {/* --- CENTER MAT: Market (Deck) & Discard --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8 z-20">
        {/* Draw Deck */}
        <button 
          onClick={pickFromMarket} 
          disabled={!isMyTurn || isProcessing} 
          className={"relative transition-transform active:scale-95 " + (!isMyTurn ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-2')}
        >
          <div className="w-16 h-24 rounded-xl border-2 border-amber-700/50 bg-[#2A1B12] flex items-center justify-center shadow-xl relative overflow-hidden">
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
            <span className="text-2xl relative z-10 text-amber-500/50">🂠</span>
          </div>
          <span className="absolute -bottom-6 inset-x-0 text-center text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">Market</span>
        </button>

        {/* Discard Pile */}
        <div className="relative w-20 h-32">
          {state.discard.slice(-3).map((c, i, arr) => {
            const isTop = i === arr.length - 1;
            return (
              <div 
                key={c.id} 
                className="absolute inset-0 transition-all duration-300" 
                style={{ transform: "rotate(" + ((c.id.length % 10) - 5) + "deg)" }}
              >
                <Card card={c} isTop={isTop} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Log / Alert */}
      <div className="absolute top-[28%] inset-x-0 z-10 flex justify-center pointer-events-none">
        <span className="bg-black/70 text-amber-100 text-sm px-5 py-2 rounded-full border border-amber-900/50 backdrop-blur-sm">
          {lastAction}
        </span>
      </div>

      {/* --- MY HAND (Bottom Row) --- */}
      <div className="absolute bottom-0 inset-x-0 z-40 pb-6 pt-16 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex justify-center -space-x-6 sm:-space-x-8 px-4">
          {myHand.map((card, index) => {
            const isSelected = selectedCard?.id === card.id;
            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={"relative w-20 h-32 sm:w-24 sm:h-36 transition-all duration-200 cursor-pointer " + (isSelected ? '-translate-y-8 z-50' : 'hover:-translate-y-6 hover:z-50')}
                style={{ zIndex: index }}
              >
                <Card card={card} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Suit Picker Modal */}
      {suitPickerOpen && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#2A1B12] p-6 rounded-3xl text-center border border-amber-700/50 shadow-2xl">
            <h3 className="text-amber-100 text-xl font-bold mb-4">Pick a Suit</h3>
            <div className="flex gap-4">
              {(["circle", "triangle", "cross", "star", "square"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuitPick(s)}
                  className="w-14 h-14 rounded-full bg-black/40 border border-white/10 hover:border-amber-500 hover:bg-amber-900/40 flex items-center justify-center text-2xl transition-transform active:scale-90"
                >
                  {s === "circle" && "🔴"}
                  {s === "triangle" && "🔺"}
                  {s === "cross" && "➕"}
                  {s === "star" && "⭐"}
                  {s === "square" && "🟩"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
