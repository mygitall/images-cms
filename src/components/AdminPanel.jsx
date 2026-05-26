import React, { useEffect, useState } from 'react';
import {
  BarChart3, Check, Coins, CreditCard, Crown, ImageIcon, LoaderCircle,
  PackageCheck, RefreshCw, ReceiptText, Settings, ShieldCheck,
  TrendingUp, UserCircle, UserPlus, Users, X
} from 'lucide-react';
import { copy } from '../i18n';
import { cx, dateInputValue, firstNumber, formatNumber, formatRangeDate, formatMembershipStatus, getAuthHeaders, generationErrorMessage } from '../utils';
import { useBodyScrollLock } from '../hooks';
import AdminMetricCard from './AdminMetricCard';
import AdminTrendChart from './AdminTrendChart';
import AdminRankList from './AdminRankList';
import './AdminPanel.css';

function AdminPanel({ open, language, session, casesById, onClose, onOpenCase }) {
  const t = copy[language];
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [range, setRange] = useState('7d');
  const [customStart, setCustomStart] = useState(() => dateInputValue(29));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue());
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [apiProfiles, setApiProfiles] = useState([]);
  const [activeApi, setActiveApi] = useState('');
  const [apiStatus, setApiStatus] = useState('');
  const [apiModels, setApiModels] = useState([]);
  const [adjustment, setAdjustment] = useState(null);
  const [adjustStatus, setAdjustStatus] = useState('idle');
  const [apiSwitchBusy, setApiSwitchBusy] = useState(false);
  const [editProfile, setEditProfile] = useState(null); // { name, api_key, base_url } | 'new'
  const [editKey, setEditKey] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editName, setEditName] = useState('');
  useBodyScrollLock(open);

  async function loadApiConfig() {
    try {
      const response = await fetch('/api/admin/api-config', { headers: getAuthHeaders(session) });
      const payload = await response.json().catch(() => ({}));
      if (payload?.ok) {
        setApiProfiles(payload.profiles || []);
        setActiveApi(payload.active || '');
        setApiStatus(payload.apiStatus || '');
        setApiModels(payload.models || []);
      }
    } catch {}
  }

  async function handleApiSwitch(profileName) {
    setApiSwitchBusy(true);
    try {
      const response = await fetch('/api/admin/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(session) },
        body: JSON.stringify({ active: profileName })
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.ok) { setActiveApi(payload.active); loadApiConfig(); }
    } catch {}
    setApiSwitchBusy(false);
  }

  async function handleApiSave(event) {
    event.preventDefault();
    setApiSwitchBusy(true);
    try {
      const body = editProfile === 'new'
        ? { addProfile: editName.trim(), api_key: editKey.trim(), base_url: editUrl.trim() }
        : { editProfile: editProfile.name, api_key: editKey.trim(), base_url: editUrl.trim() };
      const response = await fetch('/api/admin/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(session) },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.ok) { setEditProfile(null); loadApiConfig(); }
    } catch {}
    setApiSwitchBusy(false);
  }

  async function handleApiDelete(profileName) {
    if (!confirm((language === 'zh' ? '确定删除 API' : 'Delete API') + ' "' + profileName + '"?')) return;
    setApiSwitchBusy(true);
    try {
      await fetch('/api/admin/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(session) },
        body: JSON.stringify({ deleteProfile: profileName })
      });
      loadApiConfig();
    } catch {}
    setApiSwitchBusy(false);
  }

  function openEditProfile(profile) {
    setEditProfile(profile || 'new');
    setEditKey(profile && profile.name ? '' : '');
    setEditUrl(profile && profile.name ? '' : '');
    setEditName('');
  }

  async function loadAdminData(nextRange = range, nextStart = customStart, nextEnd = customEnd) {
    if (!session?.access_token && !session?.phpSession) {
      setStatus('error');
      setMessage(t.adminOnly);
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const headers = getAuthHeaders(session);
      const params = new URLSearchParams({ range: nextRange });
      if (nextRange === 'custom') {
        params.set('start', nextStart);
        params.set('end', nextEnd);
      }
      const [usersResponse, metricsResponse] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch(`/api/admin/metrics?${params.toString()}`, { headers })
      ]);
      const usersPayload = await usersResponse.json().catch(() => ({}));
      const metricsPayload = await metricsResponse.json().catch(() => ({}));
      if (!usersResponse.ok || !usersPayload.ok) {
        throw new Error(usersPayload.error || 'SERVER_NOT_CONFIGURED');
      }
      if (!metricsResponse.ok || !metricsPayload.ok) {
        throw new Error(metricsPayload.error || 'SERVER_NOT_CONFIGURED');
      }
      setUsers(usersPayload.users || []);
      setMetrics(metricsPayload);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(
        error.message === 'SERVER_NOT_CONFIGURED'
          ? t.checkoutUnavailable
          : error.message === 'INVALID_DATE_RANGE'
            ? t.invalidDateRange
            : generationErrorMessage(error.message, language)
      );
    }
  }

  function handleCustomApply() {
    const start = customStart || dateInputValue(30);
    const end = customEnd || dateInputValue(0);
    setRange('custom');
    setCustomStart(start);
    setCustomEnd(end);
    loadAdminData('custom', start, end);
  }

  async function handleAdjustCredits(event) {
    event.preventDefault();
    if (!adjustment?.userId) return;
    setAdjustStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/admin/credits/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session)
        },
        body: JSON.stringify({
          userId: adjustment.userId,
          amount: Number(adjustment.amount),
          reason: adjustment.reason
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'CREDIT_ADJUSTMENT_FAILED');
      }
      setAdjustment(null);
      setAdjustStatus('idle');
      await loadAdminData();
    } catch (error) {
      setAdjustStatus('error');
      setMessage(generationErrorMessage(error.message, language));
    }
  }

  useEffect(() => {
    if (open) { loadAdminData(range); loadApiConfig(); }
  }, [open, session?.access_token, session?.phpSession, range]);

  if (!open) return null;
  const traffic = metrics?.traffic || {};
  const business = metrics?.business || {};
  const trafficTotals = traffic.totals || {};
  const businessTotals = business.totals || {};
  const businessRange = business.range || {};
  const selectedRange = metrics?.range;
  const selectedRangeLabel = selectedRange?.startDate && selectedRange?.endDate
    ? `${formatRangeDate(selectedRange.startDate, language)} - ${formatRangeDate(selectedRange.endDate, language)}`
    : '';
  const analyticsMessage = !traffic.configured
    ? t.analyticsNotConfigured
    : traffic.error
      ? t.analyticsLoadFailed
      : '';
  const trafficSeries = [
    { key: 'pv', label: t.pv, color: '#42e6ff', area: true },
    { key: 'uv', label: t.uv, color: '#c7ff65' },
    { key: 'visits', label: t.visits, color: '#ff8f70', dashed: true }
  ];
  const businessSeries = [
    { key: 'generations', label: t.rangeGenerations, color: '#42e6ff', area: true },
    { key: 'registrations', label: t.registrations, color: '#c7ff65' },
    { key: 'creditsConsumed', label: t.creditsConsumed, color: '#ff8f70', dashed: true }
  ];

  return (
    <div
      className="previewOverlay adminOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="adminDialog" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <button className="previewClose" type="button" onClick={onClose} aria-label={t.closePreview}>
          <X size={20} />
        </button>
        <div className="adminHeader">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={16} />
              {t.superAdmin}
            </span>
            <h2 id="admin-title">{t.adminTitle}</h2>
            <p>{t.adminSubtitle}</p>
          </div>
          <div className="adminHeaderActions">
            <div className="adminRangeToggle" role="group" aria-label={t.adminMetrics}>
              {[
                ['today', t.rangeToday],
                ['7d', t.range7d],
                ['30d', t.range30d],
                ['90d', t.range90d],
                ['custom', t.customRange]
              ].map(([value, label]) => (
                <button
                  className={cx(range === value && 'active')}
                  type="button"
                  onClick={() => setRange(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
            {range === 'custom' ? (
              <div className="adminCustomRange">
                <label>
                  <span>{t.startDate}</span>
                  <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                </label>
                <label>
                  <span>{t.endDate}</span>
                  <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                </label>
                <button type="button" onClick={handleCustomApply} disabled={status === 'loading'}>
                  {t.applyRange}
                </button>
              </div>
            ) : null}
            <button type="button" onClick={() => loadAdminData()} disabled={status === 'loading'}>
              {status === 'loading' ? <LoaderCircle className="spinIcon" size={17} /> : <RefreshCw size={17} />}
              {t.refresh}
            </button>
          </div>
        </div>

        {metrics ? (
          <div className="adminDashboard">
            <section className="adminBlock compact">
              <h3><Settings size={18} /> {language === 'zh' ? 'API 配置' : 'API Config'}</h3>
              <div className="apiSwitchBar">
                {apiProfiles.map((p) => (
                  <div key={p.name} className={cx('apiProfileCard', p.isActive && 'active')}>
                    <button
                      className={cx('apiSwitchBtn', apiSwitchBusy && 'busy')}
                      type="button"
                      disabled={apiSwitchBusy}
                      onClick={() => handleApiSwitch(p.name)}
                    >
                      <strong>{p.name}</strong>
                      <span>{p.base_url || ''}</span>
                      {p.isActive ? <em className={cx('apiDot', apiStatus)} /> : null}
                    </button>
                    <div className="apiProfileActions">
                      <button className="apiEditBtn" type="button" onClick={() => openEditProfile(p)} title={language === 'zh' ? '编辑' : 'Edit'}>
                        <Settings size={13} />
                      </button>
                      {p.name !== 'default' ? (
                        <button className="apiEditBtn apiDeleteBtn" type="button" onClick={() => handleApiDelete(p.name)} title={language === 'zh' ? '删除' : 'Delete'}>
                          <X size={13} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button className="apiAddBtn" type="button" onClick={() => openEditProfile('new')} title={language === 'zh' ? '新增' : 'Add'}>
                  <UserPlus size={16} /> {language === 'zh' ? '新增' : 'Add'}
                </button>
                {apiStatus ? (
                  <span className="apiStatusTag">
                    {apiStatus === 'ok' ? (language === 'zh' ? '● 正常' : '● OK') :
                     apiStatus === 'busy' ? (language === 'zh' ? '● 繁忙' : '● Busy') :
                     apiStatus === 'timeout' ? (language === 'zh' ? '● 超时' : '● Timeout') :
                     apiStatus === 'invalid' ? (language === 'zh' ? '● Key 无效' : '● Invalid Key') :
                     '● ' + apiStatus}
                  </span>
                ) : null}
              </div>
              {apiModels.length > 0 ? (
                <div className="apiModelsBar">
                  <span>{language === 'zh' ? '可用模型' : 'Models'}：</span>
                  {apiModels.map((m) => <code key={m}>{m}</code>)}
                </div>
              ) : null}
              {editProfile ? (
                <form className="apiEditForm" onSubmit={handleApiSave}>
                  <strong>{editProfile === 'new' ? (language === 'zh' ? '新增 API' : 'New API') : (language === 'zh' ? '编辑 ' : 'Edit ') + editProfile.name}</strong>
                  {editProfile === 'new' ? (
                    <input className="authInput apiEditInput" type="text" placeholder={language === 'zh' ? '名称' : 'Name'} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  ) : null}
                  <label className="apiEditLabel">Key</label>
                  <input className="authInput apiEditInput" type="text" placeholder="sk-..." value={editKey} onChange={(e) => setEditKey(e.target.value)} autoFocus={editProfile !== 'new'} />
                  <label className="apiEditLabel">URL</label>
                  <input className="authInput apiEditInput" type="text" placeholder="https://..." value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                  <div className="apiEditActions">
                    <button type="submit" disabled={apiSwitchBusy}>{apiSwitchBusy ? <LoaderCircle className="spinIcon" size={14} /> : <Check size={14} />} {language === 'zh' ? '保存' : 'Save'}</button>
                    <button type="button" onClick={() => setEditProfile(null)}>{language === 'zh' ? '取消' : 'Cancel'}</button>
                  </div>
                </form>
              ) : null}
            </section>
            <section className="adminBlock">
              <h3>
                <TrendingUp size={18} />
                {t.trafficMetrics}
              </h3>
              {analyticsMessage ? <p className="adminNotice">{analyticsMessage}</p> : null}
              {selectedRangeLabel ? (
                <p className="adminRangeSummary">
                  {t.selectedRange}: <strong>{selectedRangeLabel}</strong>
                </p>
              ) : null}
              <div className="adminMetricGrid">
                <AdminMetricCard icon={<BarChart3 size={18} />} label={t.pv} value={firstNumber(trafficTotals.pv, trafficTotals.pageViews)} />
                <AdminMetricCard icon={<Users size={18} />} label={t.uv} value={firstNumber(trafficTotals.uv, trafficTotals.activeUsers)} />
                <AdminMetricCard icon={<ReceiptText size={18} />} label={t.visits} value={firstNumber(trafficTotals.visits, trafficTotals.sessions)} />
                <AdminMetricCard icon={<UserPlus size={18} />} label={t.newUsers} value={trafficTotals.newUsers} />
              </div>
              <div className="adminChartGrid">
                <div className="adminPanelCard chart">
                  <h4>{t.trafficTrend}</h4>
                  {traffic.configured && traffic.daily?.length ? (
                    <AdminTrendChart rows={traffic.daily} series={trafficSeries} language={language} emptyLabel={t.noAnalyticsRows} />
                  ) : (
                    <p className="emptyTransactions">{t.noAnalyticsRows}</p>
                  )}
                </div>
              </div>
              <div className="adminTrafficGrid">
                <div className="adminPanelCard">
                  <h4>{t.topPages}</h4>
                  <AdminRankList rows={traffic.topPages || []} type="pages" language={language} />
                </div>
                <div className="adminPanelCard">
                  <h4>{t.channels}</h4>
                  <AdminRankList rows={traffic.channels || []} type="channels" language={language} />
                </div>
                <div className="adminPanelCard">
                  <h4>{t.countries}</h4>
                  <AdminRankList rows={traffic.countries || []} type="countries" language={language} />
                </div>
              </div>
            </section>

            <section className="adminBlock">
              <h3>
                <ShieldCheck size={18} />
                {t.businessMetrics}
              </h3>
              <div className="adminMetricGrid">
                <AdminMetricCard icon={<Users size={18} />} label={t.registeredUsers} value={firstNumber(businessTotals.registeredUsers, business.totalUsers)} hint={`${t.newRegistrations}: ${formatNumber(firstNumber(businessRange.newRegistrations, business.rangeUsers))}`} />
                <AdminMetricCard icon={<Crown size={18} />} label={t.activeMemberships} value={firstNumber(businessTotals.activeMembers, business.activeMemberships)} hint={`${t.newMembers}: ${formatNumber(firstNumber(businessRange.newMembers, business.rangeMemberships))}`} />
                <AdminMetricCard icon={<ImageIcon size={18} />} label={t.totalGenerationsMetric} value={firstNumber(businessTotals.totalGenerations, business.totalGenerations)} hint={`${t.rangeGenerations}: ${formatNumber(firstNumber(businessRange.generations, business.rangeGenerations))}`} />
                <AdminMetricCard icon={<PackageCheck size={18} />} label={t.succeeded} value={firstNumber(businessTotals.succeededGenerations, business.succeededGenerations)} hint={`${t.rangeGenerations}: ${formatNumber(firstNumber(businessRange.succeededGenerations, business.rangeSucceededGenerations))}`} />
                <AdminMetricCard icon={<Coins size={18} />} label={t.creditsConsumed} value={firstNumber(businessTotals.totalCreditsConsumed, business.totalGenerationCredits)} hint={`${t.rangeGenerations}: ${formatNumber(firstNumber(businessRange.creditsConsumed, business.rangeGenerationCredits))}`} />
                <AdminMetricCard icon={<X size={18} />} label={t.failed} value={firstNumber(businessTotals.failedGenerations, business.failedGenerations)} />
                <AdminMetricCard icon={<LoaderCircle size={18} />} label={t.pending} value={firstNumber(businessTotals.pendingGenerations, business.pendingGenerations)} />
                <AdminMetricCard icon={<Coins size={18} />} label={t.creditsInCirculation} value={firstNumber(businessTotals.totalCreditBalance, business.totalCreditBalance)} />
                <AdminMetricCard icon={<CreditCard size={18} />} label={t.purchasedCredits} value={firstNumber(businessTotals.purchasedCredits, business.purchasedCredits)} />
                <AdminMetricCard icon={<Crown size={18} />} label={t.membershipCredits} value={firstNumber(businessTotals.membershipCredits, business.membershipCredits)} />
              </div>
              <div className="adminChartGrid">
                <div className="adminPanelCard chart">
                  <h4>{t.businessTrend}</h4>
                  {business.daily?.length ? (
                    <AdminTrendChart rows={business.daily} series={businessSeries} language={language} emptyLabel={t.noAnalyticsRows} />
                  ) : (
                    <p className="emptyTransactions">{t.noAnalyticsRows}</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="adminHeader compact">
          <div>
            <h3>{t.users}</h3>
          </div>
          <button type="button" onClick={() => loadAdminData()} disabled={status === 'loading'}>
            {status === 'loading' ? <LoaderCircle className="spinIcon" size={17} /> : <RefreshCw size={17} />}
            {t.refresh}
          </button>
        </div>
        {status === 'loading' ? (
          <div className="adminState">
            <LoaderCircle className="spinIcon" size={20} />
            {t.loadingUsers}
          </div>
        ) : null}
        {status === 'error' ? <p className="authMessage error">{message || t.adminOnly}</p> : null}
        {adjustment ? (
          <form className="adminAdjustForm" onSubmit={handleAdjustCredits}>
            <strong>{adjustment.email}</strong>
            <label>
              {t.creditAmount}
              <input
                type="number"
                step="1"
                value={adjustment.amount}
                onChange={(event) => setAdjustment((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>
            <label>
              {t.reason}
              <input
                value={adjustment.reason}
                onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={adjustStatus === 'loading'}>
              {adjustStatus === 'loading' ? <LoaderCircle className="spinIcon" size={16} /> : <Coins size={16} />}
              {t.applyAdjustment}
            </button>
          </form>
        ) : null}
        {adjustStatus === 'error' ? <p className="authMessage error">{message}</p> : null}
        {status !== 'loading' && !users.length && status !== 'error' ? (
          <div className="adminState">
            <Users size={20} />
            {t.noUsers}
          </div>
        ) : null}
        {users.length ? (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>{t.users}</th>
                  <th>{t.role}</th>
                  <th>{t.creditBalance}</th>
                  <th>{t.currentPlan}</th>
                  <th>{t.freeGeneration}</th>
                  <th>{t.totalGenerations}</th>
                  <th>{t.spentCredits}</th>
                  <th>{t.purchased}</th>
                  <th>{t.lastGeneration}</th>
                  <th>{t.createdAt}</th>
                  <th>{t.adminAdjust}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="adminUserCell">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserCircle size={28} />}
                        <div>
                          <strong>{user.email}</strong>
                          {user.fullName ? <span>{user.fullName}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td><span className="roleBadge">{user.role}</span></td>
                    <td>{user.creditBalance}</td>
                    <td>{formatMembershipStatus(user.membership, language)}</td>
                    <td>{user.freeUsed ? t.freeUsedShort : t.freeReady}</td>
                    <td>{formatNumber(user.usage?.totalGenerations)}</td>
                    <td>{formatNumber(user.usage?.totalGenerationCredits)}</td>
                    <td>{formatNumber(user.usage?.purchasedCredits)}</td>
                    <td>
                      {user.usage?.lastGenerationCaseId ? (
                        <button
                          className="tableAction compactAction"
                          type="button"
                          onClick={() => {
                            const caseItem = casesById?.get(Number(user.usage.lastGenerationCaseId));
                            if (caseItem) onOpenCase?.(caseItem);
                          }}
                          disabled={!casesById?.has(user.usage.lastGenerationCaseId)}
                        >
                          <ImageIcon size={14} />
                          #{user.usage.lastGenerationCaseId}
                        </button>
                      ) : '-'}
                    </td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US') : '-'}</td>
                    <td>
                      <button
                        className="tableAction"
                        type="button"
                        onClick={() => setAdjustment({
                          userId: user.id,
                          email: user.email,
                          amount: 10,
                          reason: ''
                        })}
                      >
                        <Coins size={15} />
                        {t.adminAdjust}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default AdminPanel;
