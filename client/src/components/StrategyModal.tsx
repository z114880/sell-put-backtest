import { useEffect } from "react";

interface StrategyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StrategyModal({ open, onClose }: StrategyModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Strategy &amp; Methodology
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 text-sm text-gray-700 leading-relaxed space-y-6 strategy-doc overflow-y-auto">

          {/* ---- 策略概述 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">策略概述</h3>
            <p>
              本工具对比两种策略：<strong>Buy &amp; Hold</strong>（买入并持有标的 ETF/股票）
              与 <strong>Cash-Secured Put</strong>（以现金担保卖出 Put 期权并定期 Roll）。
            </p>
            <p className="mt-2">
              Sell Put 策略的核心逻辑：每个周期（周/双周/月/季）的 <strong>周四收盘</strong> 时，
              根据目标 Delta 选择行权价，卖出 Put 收取权利金；在下一个周期的周四收盘时平仓旧仓位并开新仓，周而复始。
            </p>
          </section>

          {/* ---- 定价模型 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">定价模型</h3>
            <p>
              使用 <strong>Black-Scholes 模型</strong> 计算 Put 期权理论价格：
            </p>
            <div className="bg-gray-50 rounded-lg p-4 my-3 font-mono text-xs overflow-x-auto">
              P = K &middot; e<sup>-rT</sup> &middot; N(-d<sub>2</sub>) - S &middot; N(-d<sub>1</sub>)<br />
              d<sub>1</sub> = [ln(S/K) + (r + &sigma;&sup2;/2)T] / (&sigma;&radic;T)<br />
              d<sub>2</sub> = d<sub>1</sub> - &sigma;&radic;T
            </div>
            <p>其中 S = 现价，K = 行权价，r = 无风险利率，&sigma; = 波动率，T = 到期时间（年）。</p>
          </section>

          {/* ---- Delta 选 Strike ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delta 与行权价选择</h3>
            <p>
              Put Delta = N(d<sub>1</sub>) - 1，取值 (-1, 0)。用户输入目标 Delta 的绝对值（如 30 表示 -0.30），
              系统通过二分法（bisection）求解满足该 Delta 的行权价 K，然后 <strong>四舍五入到整数</strong>（模拟标准期权 strike 间距），
              再用取整后的 K 重新计算实际权利金。
            </p>
            <table className="w-full mt-3 text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Delta</th>
                  <th className="px-3 py-2 text-left border-b">含义</th>
                  <th className="px-3 py-2 text-left border-b">特点</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2">50</td>
                  <td className="px-3 py-2">ATM（平值）</td>
                  <td className="px-3 py-2">权利金最高，被行权概率 ~50%</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2">30</td>
                  <td className="px-3 py-2">OTM（虚值）</td>
                  <td className="px-3 py-2">权利金较低，被行权概率 ~30%，下行保护更大</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">16</td>
                  <td className="px-3 py-2">1 sigma OTM</td>
                  <td className="px-3 py-2">权利金较少，约 84% 概率 OTM 到期</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ---- 波动率 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">波动率计算</h3>
            <p>
              <strong>历史波动率（HV）：</strong>取开仓日前 <em>Vol Window</em> 个交易日的收盘价，
              计算对数收益率的标准差，再年化（&times; &radic;252）。
            </p>
            <p className="mt-2">
              <strong>IV 溢价：</strong>真实市场中隐含波动率（IV）通常高于 HV，
              因为期权卖方需要被补偿「波动率风险溢价」，且 Put 端存在 skew。
              本工具通过 IV Premium 参数模拟：
            </p>
            <div className="bg-gray-50 rounded-lg p-3 my-2 font-mono text-xs">
              定价用波动率 = HV &times; (1 + IV Premium)
            </div>
            <p>
              例如 HV = 20%、IV Premium = 20% 时，定价用 &sigma; = 24%。
              这同时影响 Delta 选 strike 和权利金定价，保持一致性。
            </p>
            <p className="mt-2 text-gray-500 text-xs">
              <strong>取舍：</strong>真实的 IV 随 strike（skew）和到期时间（term structure）变化，本模型用统一的溢价系数近似，
              无法精确捕捉尾部风险下 OTM put IV 的额外上翘。对于 Delta 20-50 范围的 ETF 期权，这是合理的简化。
            </p>
          </section>

          {/* ---- Roll 机制 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Roll 机制</h3>
            <p>
              在每个周期的 <strong>周四收盘价</strong> 执行 roll（平旧仓 + 开新仓）：
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>Weekly：</strong>每周四</li>
              <li><strong>Biweekly：</strong>每隔一周的周四</li>
              <li><strong>Monthly：</strong>每月最后一个周四</li>
              <li><strong>Quarterly：</strong>每季末月（3/6/9/12月）最后一个周四</li>
            </ul>
            <p className="mt-2">
              若周四为非交易日（节假日），自动回退到最近的前一个交易日。
            </p>
            <p className="mt-2 text-gray-500 text-xs">
              <strong>取舍：</strong>选择周四而非周五 roll 是因为周五经常遇到期权到期日带来的异常波动和流动性下降。
              本模型不模拟持有到期后被行权（assignment）拿股票的情况，所有仓位都在 roll day 以 BS 理论价平仓。
            </p>
          </section>

          {/* ---- 保证金与合约数 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">保证金与合约数量</h3>
            <p>
              采用 <strong>Cash-Secured</strong> 模式：每张 Put 需要锁定 <code>strike &times; 100</code> 美元保证金。
              合约数 = <code>floor(可用资金 / (strike &times; 100))</code>。
            </p>
            <p className="mt-2">
              OTM put 的 strike 低于现价，因此同样资金可卖出更多合约（相比 ATM）。
            </p>
          </section>

          {/* ---- 交易成本 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">交易成本建模</h3>
            <p>每次开仓和平仓各计两项成本：</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>
                <strong>Commission：</strong>每张合约的固定佣金（开仓/平仓各收一次）。
                IBKR 标准 $0.65/张。
              </li>
              <li>
                <strong>Bid-Ask Spread：</strong>以 mid-price 的百分比计。
                卖出（开仓）时实际成交价 = mid - spread/2；
                买回（平仓）时实际成交价 = mid + spread/2。
                高流动性 ETF（SPY/QQQ）通常 1-3%。
              </li>
            </ul>
          </section>

          {/* ---- MtM ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">逐日盯市 (Mark-to-Market)</h3>
            <p>
              持仓期间，每个交易日用 BS 模型重新计算 short put 的理论价值：
            </p>
            <div className="bg-gray-50 rounded-lg p-3 my-2 font-mono text-xs">
              每日 Equity = 持有现金 - Put理论价 &times; 100 &times; 合约数
            </div>
            <p>
              开仓当日的 Equity = 本金 - 交易成本（spread + commission），
              反映建仓的即时损耗。
            </p>
            <p className="mt-2 text-gray-500 text-xs">
              <strong>取舍：</strong>MtM 过程中使用开仓时的波动率（&sigma;）保持不变。
              真实市场中 IV 会随行情波动——大跌时 IV 飙升会放大 short put 的浮亏。
              因此在剧烈下跌行情中，本模型的 drawdown 可能被低估。
              这是当前模型与真实收益曲线之间最主要的系统性偏差。
            </p>
          </section>

          {/* ---- 现金利息 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">现金利息</h3>
            <p>
              可选开启。模拟将保证金投入货币市场基金（如 SGOV）获得的利息收入。
              按交易日复利计算：
            </p>
            <div className="bg-gray-50 rounded-lg p-3 my-2 font-mono text-xs">
              日利率 = (1 + 年化利率)<sup>1/252</sup> - 1
            </div>
            <p>
              持仓期间对 cashInCycle 计息；空仓期间对 capital 计息。
            </p>
          </section>

          {/* ---- 统计指标 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">统计指标</h3>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                <strong>Total Return：</strong>(期末净值 - 初始本金) / 初始本金
              </li>
              <li>
                <strong>Annualized Return：</strong>(1 + Total Return)<sup>1/years</sup> - 1
              </li>
              <li>
                <strong>Max Drawdown：</strong>权益曲线从任意峰值到后续谷值的最大回撤百分比
              </li>
              <li>
                <strong>Sharpe Ratio：</strong>
                日超额收益均值 &times; &radic;252 / 日收益年化标准差。
                超额收益 = 日收益 - 无风险日利率
              </li>
              <li>
                <strong>Win Rate：</strong>PnL &gt; 0 的交易笔数 / 总交易笔数（仅 Sell Put）
              </li>
            </ul>
          </section>

          {/* ---- 已知局限 ---- */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">已知局限与偏差</h3>
            <ol className="list-decimal ml-5 space-y-2">
              <li>
                <strong>MtM 不更新 IV：</strong>
                持仓期间波动率固定为开仓时的值。真实市场 IV 随行情剧烈变化（尤其大跌时 VIX 飙升），
                导致本模型在急跌行情中 <em>低估</em> 短期浮亏和 max drawdown。
              </li>
              <li>
                <strong>IV skew 未建模：</strong>
                统一的 IV Premium 无法反映 OTM put 相对 ATM 的额外 skew 溢价。
                深度 OTM put（Delta &lt; 20）的真实权利金会高于模型定价。
              </li>
              <li>
                <strong>不模拟 assignment：</strong>
                所有仓位在 roll day 以 BS 理论价平仓，不考虑 ITM 到期被行权后持有股票的场景。
              </li>
              <li>
                <strong>价格数据来源：</strong>
                使用 Yahoo Finance 收盘价，不含盘后交易。遇到除权除息日、拆股等事件可能有偏差。
              </li>
            </ol>
          </section>

        </div>
      </div>
    </div>
  );
}
