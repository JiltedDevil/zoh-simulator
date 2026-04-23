/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Settings2, Activity, FunctionSquare, AlertCircle, Maximize, Timer, Info, X, AlertTriangle } from 'lucide-react';
import * as math from 'mathjs';
import Plotly from 'plotly.js-basic-dist';
import createPlotlyComponent from 'react-plotly.js/factory';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

const Plot = createPlotlyComponent(Plotly);

export default function App() {
  const [showModal, setShowModal] = useState<boolean>(true);
  const [sampleTime, setSampleTime] = useState<number>(0.5);
  const [equationString, setEquationString] = useState<string>('3 * cos(2 * t)');
  const [equationError, setEquationError] = useState<string | null>(null);
  
  // Simulation bounds
  const [tMinStr, setTMinStr] = useState<string>('0');
  const [tMaxStr, setTMaxStr] = useState<string>('20');
  
  const parsedTMin = parseFloat(tMinStr) || 0;
  let parsedTMax = parseFloat(tMaxStr) || 20;
  if (parsedTMax <= parsedTMin) parsedTMax = parsedTMin + 1; // Prevent invalid ranges

  // Compile equation dynamically using Math.js
  const calculateContinuous = useMemo(() => {
    try {
      const node = math.parse(equationString);
      const compiled = node.compile();
      compiled.evaluate({ t: 0 });
      setEquationError(null);
      return (t: number) => {
        try {
           return compiled.evaluate({ t });
        } catch (e) {
           return 0;
        }
      };
    } catch (err: any) {
      setEquationError(err.message || '無效的數學表達式');
      return (t: number) => 0; // Fallback to 0 if invalid
    }
  }, [equationString]);

  // 1. Generate High-Resolution Continuous Data
  const continuousData = useMemo(() => {
    const tValues = [];
    const yValues = [];
    // Dynamic step to maintain resolution while keeping array size reasonable (~1000 points)
    const step = Math.max(0.01, (parsedTMax - parsedTMin) / 1000);
    for (let t = parsedTMin; t <= parsedTMax; t += step) {
      tValues.push(Number(t.toFixed(3)));
      yValues.push(calculateContinuous(t));
    }
    return { t: tValues, y: yValues };
  }, [calculateContinuous, parsedTMin, parsedTMax]);

  // 2. Generate Discrete Sampled Data (including Stem lines)
  const discreteData = useMemo(() => {
    const tValues = [];
    const yValues = [];
    
    // For Stem plot effect in Plotly
    const stemX = [];
    const stemY = [];

    const T = Math.max(0.01, sampleTime); // Prevent division by zero
    // Start strictly on multiples of T relative to 0
    let t = Math.floor(parsedTMin / T) * T;
    
    while (t <= parsedTMax + 0.0001) {
      if (t >= parsedTMin) { // Only record points inside boundary
        const time = Number(t.toFixed(3));
        const val = calculateContinuous(t);
        tValues.push(time);
        yValues.push(val);

        stemX.push(time, time, null);
        stemY.push(0, val, null);
      }
      t += T;
    }
    return { t: tValues, y: yValues, stemX, stemY };
  }, [sampleTime, calculateContinuous, parsedTMin, parsedTMax]);

  // 3. Generate ZOH Data (Zero-Order Hold)
  const zohData = useMemo(() => {
    const tValues = [...discreteData.t];
    const yValues = [...discreteData.y];
    
    if (tValues.length > 0) {
      const lastT = tValues[tValues.length - 1];
      if (lastT < parsedTMax) {
        tValues.push(parsedTMax);
        yValues.push(yValues[yValues.length - 1]);
      }
    }
    return { t: tValues, y: yValues };
  }, [discreteData, parsedTMax]);

  // Plotly Data Config
  const plotData: any[] = [
    // Subplot 1: Continuous
    {
      x: continuousData.t,
      y: continuousData.y,
      type: 'scatter',
      mode: 'lines',
      name: '連續訊號',
      line: { color: '#3b82f6', width: 2.5 },
      xaxis: 'x',
      yaxis: 'y'
    },
    // Subplot 2: Discrete Stems
    {
      x: discreteData.stemX,
      y: discreteData.stemY,
      type: 'scatter',
      mode: 'lines',
      name: '離散線段',
      line: { color: '#ef4444', width: 2 },
      hoverinfo: 'none',
      xaxis: 'x2',
      yaxis: 'y2'
    },
    // Subplot 2: Discrete Markers
    {
      x: discreteData.t,
      y: discreteData.y,
      type: 'scatter',
      mode: 'markers',
      name: '取樣點',
      marker: { color: '#ef4444', size: 8, line: { color: 'white', width: 1 } },
      xaxis: 'x2',
      yaxis: 'y2'
    },
    // Subplot 3: ZOH
    {
      x: zohData.t,
      y: zohData.y,
      type: 'scatter',
      mode: 'lines',
      name: 'ZOH',
      line: { color: '#10b981', width: 2.5, shape: 'hv' },
      xaxis: 'x3',
      yaxis: 'y3'
    },
    // Subplot 3: ZOH Markers
    {
      x: discreteData.t,
      y: discreteData.y,
      type: 'scatter',
      mode: 'markers',
      name: 'ZOH 取樣點',
      marker: { color: '#10b981', size: 6, line: { color: 'white', width: 1 } },
      hoverinfo: 'none',
      xaxis: 'x3',
      yaxis: 'y3'
    }
  ];

  const plotLayout: any = {
    autosize: true,
    height: 850, // 稍微增加一點總高度，讓三張圖的 X 軸標籤有足夠空間
    margin: { t: 40, b: 50, l: 60, r: 20 },
    showlegend: false,
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    font: { color: '#a1a1aa' },
    // 將 ygap 調大為 0.35，避免圖表之間的數字和標題擠在一起
    grid: { rows: 3, columns: 1, pattern: 'independent', roworder: 'top to bottom', ygap: 0.35 },

    // Top: Continuous
    // 拿掉 showticklabels: false，並加上 title
    xaxis: { title: '時間 t (秒)', matches: 'x3', gridcolor: '#3f3f46', zerolinecolor: '#52525b' },
    yaxis: { title: 'y(t)', gridcolor: '#3f3f46', zerolinecolor: '#52525b', matches: 'y3', range: [-20, 20] },

    // Middle: Discrete
    // 拿掉 showticklabels: false，並加上 title
    xaxis2: { title: '時間 t (秒)', matches: 'x3', gridcolor: '#3f3f46', zerolinecolor: '#52525b' },
    yaxis2: { title: 'y(t)', gridcolor: '#3f3f46', zerolinecolor: '#52525b', matches: 'y3', range: [-20, 20] },

    // Bottom: ZOH
    xaxis3: { title: '時間 t (秒)', gridcolor: '#3f3f46', zerolinecolor: '#52525b' },
    yaxis3: { title: 'y(t)', gridcolor: '#3f3f46', zerolinecolor: '#52525b', range: [-20, 20] },
    
    hovermode: 'x unified',
    annotations: [
      {
        text: '<b>1. 原始連續訊號 (Continuous)</b>',
        font: { size: 14, color: '#e4e4e7' },
        x: 0,
        y: 1.05,
        xref: 'paper',
        yref: 'y domain',
        xanchor: 'left',
        yanchor: 'bottom',
        showarrow: false
      },
      {
        text: '<b>2. 離散取樣訊號 (Discrete)</b>',
        font: { size: 14, color: '#e4e4e7' },
        x: 0,
        y: 1.05,
        xref: 'paper',
        yref: 'y2 domain',
        xanchor: 'left',
        yanchor: 'bottom',
        showarrow: false
      },
      {
        text: '<b>3. 零階保持訊號 (ZOH)</b>',
        font: { size: 14, color: '#e4e4e7' },
        x: 0,
        y: 1.05,
        xref: 'paper',
        yref: 'y3 domain',
        xanchor: 'left',
        yanchor: 'bottom',
        showarrow: false
      }
    ]
  };
  const plotConfig = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'] as import('plotly.js').ModeBarDefaultButtons[],
    scrollZoom: true
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-4 md:p-8 relative">
      
      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowModal(false)}
          ></div>
          
          {/* Modal Container */}
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-800/50">
              <h2 className="text-xl font-bold tracking-tight text-white">歡迎使用訊號取樣與 ZOH 模擬工具</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors outline-none focus:ring-2 focus:ring-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="px-6 py-6 text-zinc-400 space-y-6 text-sm md:text-base leading-relaxed overflow-y-auto max-h-[60vh]">
              
              {/* Box 1: T and fs definition */}
              <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-xl">
                <h3 className="font-bold text-zinc-200 flex items-center gap-2 mb-2">
                  <Settings2 className="w-5 h-5 text-zinc-400" /> 什麼是取樣時間 (<InlineMath math="T" />) 與頻率 (<InlineMath math="f_s" />)？
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400 marker:text-zinc-500">
                  <li><strong>取樣時間 <InlineMath math="T" />：</strong>代表每隔幾秒擷取一次訊號。</li>
                  <li><strong>取樣頻率 <InlineMath math="f_s" />：</strong>代表一秒鐘擷取幾次訊號（單位 Hz）。</li>
                  <li className="text-zinc-300 font-medium mt-2 list-none py-1.5 px-3 bg-zinc-800 rounded-lg shadow-sm border border-zinc-700 inline-block">
                    兩者互為倒數：<InlineMath math="f_s = 1 / T" />。
                  </li>
                </ul>
              </div>

              {/* Box 2: Nyquist */}
              <div>
                <h3 className="font-bold text-zinc-200 flex items-center gap-2 mb-1.5">
                  <Activity className="w-5 h-5 text-emerald-500" /> 夏農取樣定理 (Shannon's Sampling Theorem)
                </h3>
                <p className="text-zinc-400 pl-7 leading-loose">
                  為了能完美還原原始的連續訊號，<strong>取樣頻率必須「大於」原始訊號中最高頻率的兩倍</strong>。若低於此頻率，將無法正確還原原始的連續訊號。
                </p>
              </div>
              
              {/* Box 3: Hands on */}
              <div>
                <h3 className="font-bold text-zinc-200 flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> 動手玩玩看：觀察失真 (Aliasing)
                </h3>
                <div className="pl-6 ml-2.5 border-l-2 border-red-900/50">
                  <p className="text-zinc-400">
                    試著把取樣頻率 <InlineMath math="f_s" /> 拉低（例如小於 1.0Hz），觀察第三張 zero-order hold(ZOH) 的訊號圖。<br/>
                    你會發現當頻率太低時，重建出來的圖形會變成完全不同的波形，這就是所謂的 <strong className="text-red-400">「失真 (Aliasing)」</strong>！
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-end">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 bg-zinc-800 text-white font-medium rounded-xl shadow-lg hover:bg-zinc-700 outline-none focus:ring-2 focus:ring-zinc-600 transition-all border border-zinc-700"
              >
                開始使用 / 關閉
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* 1. Header Area */}
        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-zinc-300" />
              訊號取樣與 ZOH 模擬工具
            </h1>
            <p className="text-zinc-400 mt-2 text-base flex items-center flex-wrap gap-1">
              輸入自定義方程式 <InlineMath math="y(t)" /> 並調整取樣時間 <InlineMath math="T" />，來觀察離散取樣與零階保持 (Zero-Order Hold) 重建效果。
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg text-sm font-medium">
              <Maximize className="w-4 h-4 text-zinc-500" />
              提示：在圖表任意處拖曳滑鼠或滾動滾輪，可「同步縮放與移動」三張視圖！
            </div>
          </div>
          
          {/* Help Button */}
          <button 
            onClick={() => setShowModal(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-zinc-900 text-zinc-300 font-medium border border-zinc-800 rounded-xl shadow-lg hover:bg-zinc-800 hover:text-white outline-none focus:ring-2 focus:ring-zinc-600 transition-colors"
          >
            <Info className="w-4 h-4" /> 
            操作說明
          </button>
        </div>

        {/* 2. Unified Control Bar */}
        <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-2xl shadow-black/80 flex flex-col xl:flex-row items-start xl:items-end gap-8 mb-6">
          
          {/* Equation Input */}
          <div className="flex flex-col gap-2 relative">
            <label htmlFor="equation" className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
              <FunctionSquare className="w-4 h-4 text-zinc-500" /> 方程式 <InlineMath math="y(t) =" />
            </label>
            <div className="relative">
              <input
                id="equation"
                type="text"
                value={equationString}
                onChange={(e) => setEquationString(e.target.value)}
                className={`w-full xl:w-56 px-4 py-2 bg-black text-white border ${equationError ? 'border-red-500 focus:ring-red-500/50' : 'border-zinc-800 focus:border-zinc-600 focus:ring-zinc-700'} rounded-lg shadow-inner outline-none focus:ring-2 transition-all font-mono`}
                placeholder="3 * cos(2 * t)"
              />
              {equationError && (
                <div className="absolute -bottom-6 left-0 text-red-500 text-xs flex items-center gap-1 whitespace-nowrap">
                  <AlertCircle className="w-3 h-3" /> 輸入格式錯誤
                </div>
              )}
            </div>
          </div>

          {/* Time Bound Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-zinc-500" /> 模擬範圍 (<InlineMath math="t" />)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tMinStr}
                onChange={(e) => setTMinStr(e.target.value)}
                className="w-20 px-3 py-2 bg-black text-white border border-zinc-800 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700 rounded-lg shadow-inner outline-none transition-all font-mono text-center text-sm"
                title="起始時間"
              />
              <span className="text-zinc-500 font-mono">~</span>
              <input
                type="number"
                value={tMaxStr}
                onChange={(e) => setTMaxStr(e.target.value)}
                className="w-20 px-3 py-2 bg-black text-white border border-zinc-800 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700 rounded-lg shadow-inner outline-none transition-all font-mono text-center text-sm"
                title="結束時間"
              />
            </div>
          </div>

          {/* Sampling Controls (T & fs) */}
          <div className="flex flex-col gap-5 flex-1 w-full min-w-[260px] xl:pl-4">
            {/* Sample Time T */}
            <div className="flex flex-col gap-2 relative">
              <label htmlFor="sample-time" className="text-sm font-semibold text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-zinc-500" /> 取樣時間 <InlineMath math="T" /></span>
                <span className="text-zinc-200 font-mono font-bold bg-zinc-800 px-2.5 py-0.5 rounded-md text-sm border border-zinc-700">
                  {sampleTime.toFixed(2)}s
                </span>
              </label>
              <input
                id="sample-time"
                type="range"
                min="0.05"
                max="2.0"
                step="0.01"
                value={sampleTime}
                onChange={(e) => setSampleTime(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 hover:accent-zinc-400"
              />
            </div>
            
            {/* Sample Freq fs */}
            <div className="flex flex-col gap-2 relative">
              <label htmlFor="sample-freq" className="text-sm font-semibold text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-zinc-500" /> 取樣頻率 <InlineMath math="f_s" /></span>
                <span className="text-zinc-200 font-mono font-bold bg-zinc-800 px-2.5 py-0.5 rounded-md text-sm border border-zinc-700 transition-colors">
                  {(1 / sampleTime).toFixed(1)}Hz
                </span>
              </label>
              <input
                id="sample-freq"
                type="range"
                min="0.5"
                max="20.0"
                step="0.1"
                value={1 / sampleTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSampleTime(1 / Math.max(0.01, val));
                }}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 hover:accent-zinc-400"
              />
            </div>
          </div>
        </div>

        {/* Sync Chart Area */}
        <div className="bg-zinc-900 p-2 rounded-2xl border border-zinc-800 shadow-2xl shadow-black/80 relative z-0">
          {/* Aliasing Warning Alert */}
          {(1 / sampleTime) < 1.0 && (
            <div className="absolute top-4 right-4 z-10 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-950/80 text-red-400 border border-red-900/50 shadow-lg shadow-red-900/20 rounded-xl backdrop-blur-sm">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="font-bold text-sm tracking-wide">⚠️ 發生失真 (Aliasing)</span>
              </div>
            </div>
          )}
          
          <Plot
            data={plotData}
            layout={plotLayout}
            config={plotConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      </div>
    </div>
  );
}