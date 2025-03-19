'use client';

import { useState, useEffect } from 'react';
import { useModalStore } from '@/app/store/modal';
import AddInvestmentsModal from './_component/AddInvestmentsModal';
import DeleteTransactionsModal from './_component/DeleteTransactionsModal';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
} from 'lucide-react';
import Collapse from '@mui/material/Collapse';
import axiosInstance from '@/utils/axiosInstance';
import { useCurrencyStore } from '@/app/store/currency';
import { formatCurrency } from '@/utils/formatCurrency';
import { usePortfolioStore } from '@/app/store/usePortfolioStore';
import { Transaction } from '@/model/Transaction';

// Currency 타입 정의
type SupportedCurrency =
  | 'USD'
  | 'KRW'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'CNY'
  | 'CHF'
  | 'INR'
  | 'SGD';

const Page = () => {
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
  });

  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const response = await axiosInstance.get(
          'https://api.exchangerate-api.com/v4/latest/USD'
        );
        setExchangeRates(response.data.rates);
      } catch (err) {
        console.error('환율 정보를 가져오는 중 오류 발생:', err);
      }
    };
    fetchExchangeRates();
  }, []);

  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<
    'original' | 'converted'
  >('converted');

  const { selectedCurrency } = useCurrencyStore();

  const {
    isInvestmentsModalOpen,
    setIsInvestmentsModalOpen,
    isTransactionsDeleteModalOpen,
    setIsTransactionsDeleteModalOpen,
  } = useModalStore();

  // 삭제할 단일 트랜잭션 ID를 위한 state 추가
  const [singleDeleteId, setSingleDeleteId] = useState<number | null>(null);

  // usePortfolioStore에서 선택된 포트폴리오 가져오기
  const { selectedPortfolio } = usePortfolioStore();

  // 상태 변수 추가
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);

  const fetchTransactions = async () => {
    // 선택된 포트폴리오가 없으면 데이터를 가져오지 않음
    if (!selectedPortfolio) {
      setTransactions([]);
      return;
    }

    try {
      const response = await axiosInstance.get('/transactions', {
        params: {
          portfolio_id: selectedPortfolio.portfolio_id,
          page: currentPage,
          per_page: perPage,
        },
      });

      const mappedTransactions = response.data.data.map((tx: Transaction) => ({
        ...tx,
        currency: tx.currency_code,
        originalCurrency: tx.currency_code,
      }));
      setTransactions(mappedTransactions);
      setTotalTransactions(response.data.total || mappedTransactions.length); // API에서 total을 제공하는 경우
    } catch (error) {
      console.error('거래 내역 불러오기 실패:', error);
    }
  };

  // 추가: 페이지 변경 핸들러
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // 추가: 페이지당 항목 수 변경 핸들러
  const handlePerPageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  // 의존성 배열에 currentPage와 perPage 추가
  useEffect(() => {
    fetchTransactions();
  }, [selectedPortfolio, currentPage, perPage]);

  // 페이지네이션 관련 계산
  const totalPages = Math.ceil(totalTransactions / perPage);
  const startIndex = (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(startIndex + perPage - 1, totalTransactions);

  /**
   * 금액 환산 함수
   * @param amount 원금액
   * @param fromCurrency 원금액 통화
   * @param toCurrency 변환 대상 통화
   */
  function convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ) {
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
      // 환율 데이터가 없으면 그대로 반환
      return amount;
    }
    const baseAmount = amount / exchangeRates[fromCurrency];
    return baseAmount * exchangeRates[toCurrency];
  }

  const purchaseTotals = transactions.reduce((acc, item) => {
    if (item.transaction_type === '구매') {
      const total = item.price * item.quantity;
      acc[item.currency] = (acc[item.currency] || 0) + total;
    }
    return acc;
  }, {} as Record<string, number>);

  const saleTotals = transactions.reduce((acc, item) => {
    if (item.transaction_type === '판매') {
      const total = item.price * item.quantity;
      acc[item.currency] = (acc[item.currency] || 0) + total;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalPurchaseAmount = transactions
    .filter((t) => t.transaction_type === '구매')
    .reduce((acc, cur) => acc + Number(cur.price) * Number(cur.quantity), 0);

  const enrichedTransactions = transactions.map((item) => {
    const { transaction_type, price, quantity } = item;
    const tradeValue = Number(price) * Number(quantity);

    let yoyakValue = 0;
    if (transaction_type === '구매') {
      yoyakValue = -tradeValue;
    } else if (transaction_type === '판매') {
      yoyakValue = tradeValue;
    }

    let totalProfitValue: number | null = null;
    let totalProfitRate: number | null = null;
    if (transaction_type === '판매' && totalPurchaseAmount > 0) {
      totalProfitValue = yoyakValue - totalPurchaseAmount;
      totalProfitRate = (totalProfitValue / totalPurchaseAmount) * 100;
    }

    return {
      ...item,
      yoyakValue,
      totalProfitValue,
      totalProfitRate,
    };
  });

  const totalProfitAll = enrichedTransactions.reduce((acc, cur) => {
    if (
      cur.totalProfitValue !== null &&
      typeof cur.totalProfitValue === 'number'
    ) {
      return acc + cur.totalProfitValue;
    }
    return acc;
  }, 0);

  const handleDelete = () => {
    console.log('삭제할 거래 ID:', selectedItems);
    setIsTransactionsDeleteModalOpen(true);
  };

  const getDisplayAmount = (amount: number, originalCurrency: string) => {
    if (displayCurrency === 'original') {
      // 구매 통화 그대로
      return formatCurrency(amount, originalCurrency as SupportedCurrency);
    } else {
      // 사용자 지정 통화로 환산
      const converted = convertAmount(
        amount,
        originalCurrency,
        selectedCurrency
      );
      return formatCurrency(converted, selectedCurrency as SupportedCurrency);
    }
  };

  // 구매 총액( converted 모드 시, 모든 통화를 하나로 합산 )
  const purchaseTotalConverted = Object.entries(purchaseTotals).reduce(
    (acc, [currency, total]) =>
      acc + convertAmount(total as number, currency, selectedCurrency),
    0
  );
  // 판매 총액( converted 모드 시, 모든 통화를 하나로 합산 )
  const saleTotalConverted = Object.entries(saleTotals).reduce(
    (acc, [currency, total]) =>
      acc + convertAmount(total as number, currency, selectedCurrency),
    0
  );

  // 트랜잭션 목록에 포함된 '원본 통화' 중복 여부 판단
  const uniqueCurrencies = Array.from(
    new Set(transactions.map((tx) => tx.currency))
  );
  const hasMultipleCurrencies = uniqueCurrencies.length > 1;

  // totalProfitAll(판매 건들)에 대해 converted 시 환산
  const totalProfitConverted = enrichedTransactions.reduce((acc, item) => {
    if (item.transaction_type === '판매' && item.totalProfitValue !== null) {
      // item.totalProfitValue는 'original' 기준으로 계산된 값이므로 다시 환산
      return (
        acc +
        convertAmount(item.totalProfitValue, item.currency, selectedCurrency)
      );
    }
    return acc;
  }, 0);

  return (
    <>
      {/* (기존) 모달들 */}
      {isInvestmentsModalOpen && (
        <AddInvestmentsModal
          selectedProduct={null}
          onSuccess={() => fetchTransactions()}
        />
      )}
      {isTransactionsDeleteModalOpen && (
        <DeleteTransactionsModal
          selectedItems={singleDeleteId ? [singleDeleteId] : selectedItems}
          onDeletionSuccess={() => {
            setSelectedItems([]);
            setSingleDeleteId(null);
            fetchTransactions();
          }}
        />
      )}

      <div className='p-10 bg-white rounded-2xl shadow-xl mb-7'>
        {/* "추가" 버튼을 상단에 배치 */}
        <button
          className='bg-[#e1f0ff] hover:bg-[#3699ff] text-[#3699ff] hover:text-white flex justify-center items-center gap-1 px-3.5 py-2 text-sm rounded-[0.5rem] transition-all mb-4'
          onClick={() => setIsInvestmentsModalOpen(true)}
        >
          <Plus />
          추가
        </button>

        <Collapse in={selectedItems.length === 0} timeout='auto' unmountOnExit>
          <div className='mb-6'>
            <div className='flex justify-between items-center'>
              <div className='inline-flex flex-row gap-4 p-4 rounded-md border-[1px] border-slate-200 text-sm text-slate-500'>
                <div>
                  <div>
                    <span className='text-[#1bc5bd] mr-1'>•</span>
                    구매
                  </div>
                  <div>
                    {displayCurrency === 'original' ? (
                      Object.entries(purchaseTotals).map(
                        ([currency, total]) => (
                          <p key={currency} className='text-slate-700'>
                            {formatCurrency(
                              total,
                              currency as SupportedCurrency
                            )}
                          </p>
                        )
                      )
                    ) : (
                      <p className='text-slate-700'>
                        {formatCurrency(
                          purchaseTotalConverted,
                          selectedCurrency as SupportedCurrency
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {/* 판매 합계 */}
                <div>
                  <div>
                    <span className='text-red-500 mr-1'>•</span>
                    판매
                  </div>
                  <div>
                    {displayCurrency === 'original' ? (
                      Object.entries(saleTotals).map(([currency, total]) => (
                        <p key={currency} className='text-slate-700'>
                          {formatCurrency(total, currency as SupportedCurrency)}
                        </p>
                      ))
                    ) : (
                      <p className='text-slate-700'>
                        {formatCurrency(
                          saleTotalConverted,
                          selectedCurrency as SupportedCurrency
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className='bg-slate-100 rounded-[0.5rem] p-1 drop-shadow-sm inline-block'>
                <div className='flex space-x-1'>
                  <button
                    onClick={() => setDisplayCurrency('original')}
                    className={`px-3 py-2 rounded-[0.5rem] text-sm font-medium transition-all ${
                      displayCurrency === 'original'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    구매 통화
                  </button>
                  <button
                    onClick={() => setDisplayCurrency('converted')}
                    className={`px-3 py-2 rounded-[0.5rem] text-sm font-medium transition-all ${
                      displayCurrency === 'converted'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {selectedCurrency}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Collapse>

        <div className='relative'>
          <Collapse in={selectedItems.length > 0} timeout='auto' unmountOnExit>
            <div className='mb-6'>
              <div className='flex items-center'>
                <button
                  onClick={handleDelete}
                  className='p-2 bg-[#FFE2E5] hover:bg-[#F64E60] text-[#f64e60] flex justify-center items-center gap-2 px-3.5 py-2 text-sm rounded-[0.5rem] transition-all'
                >
                  <Trash2 className='w-4 h-4' />
                  삭제 ({selectedItems.length})
                </button>
              </div>
            </div>
          </Collapse>

          <Collapse
            in={selectedItems.length === 0}
            timeout='auto'
            unmountOnExit
          >
            <div className='mb-6'>
              {/* 상단 '구매/판매' 요약과 통화 토글 버튼은 이미 위에서 처리됨 */}
            </div>
          </Collapse>
        </div>

        {/* 테이블 */}
        <div className='w-full'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='w-[50px] px-4 pb-3 text-left font-normal align-middle'>
                  <input
                    type='checkbox'
                    className="w-4 h-4 appearance-none bg-slate-200 text-white rounded-[0.2rem] relative border-2 border-transparent checked:border-transparent checked:bg-[#3699FE] checked:before:block checked:before:content-['✓'] checked:before:absolute checked:before:inset-0 checked:before:text-white checked:before:flex checked:before:items-center checked:before:justify-center transition-all"
                    checked={
                      selectedItems.length === enrichedTransactions.length &&
                      enrichedTransactions.length > 0
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(
                          enrichedTransactions.map((tx) => tx.transaction_id)
                        );
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                  />
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  거래 종류
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  보유 자산
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  날짜
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  거래량
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  가격
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  요약
                </th>
                <th className='pb-3 text-left text-slate-400 font-normal'>
                  총 수익
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrichedTransactions.map((item) => {
                const {
                  transaction_id,
                  transaction_type,
                  financial_product,
                  created_at,
                  quantity,
                  price,
                  currency,
                  profitRate,
                  yoyakValue,
                  totalProfitValue,
                  totalProfitRate,
                } = item;

                let formattedDate = '';
                if (created_at) {
                  const [year, month, day] = created_at
                    .substring(0, 10)
                    .split('-');
                  formattedDate = `${day}/${month}/${year}`;
                }

                // 요약(구매/판매 금액) 표시용
                const yoyakDisplay = getDisplayAmount(yoyakValue, currency);

                let profitRateDisplayValue: string | null = null;
                if (transaction_type === '판매' && profitRate) {
                  const absoluteValue = (price * quantity * profitRate) / 100;
                  profitRateDisplayValue = getDisplayAmount(
                    absoluteValue,
                    currency
                  );
                }

                // 총 수익 표시용
                let totalProfitDisplay: string | null = null;
                let totalProfitRateDisplay: string | null = null;
                if (transaction_type === '판매' && totalProfitValue != null) {
                  const profitConverted =
                    displayCurrency === 'converted'
                      ? convertAmount(
                          totalProfitValue,
                          currency,
                          selectedCurrency
                        )
                      : totalProfitValue;

                  const showCurrency =
                    displayCurrency === 'converted'
                      ? selectedCurrency
                      : currency;
                  totalProfitDisplay = formatCurrency(
                    profitConverted,
                    showCurrency as SupportedCurrency
                  );

                  if (totalProfitRate != null) {
                    totalProfitRateDisplay = `${
                      totalProfitRate > 0 ? '+' : ''
                    }${totalProfitRate.toFixed(2)}%`;
                  }
                }

                return (
                  <tr
                    key={transaction_id}
                    className='border-b hover:bg-slate-100'
                  >
                    <td className='px-4 py-3'>
                      <input
                        type='checkbox'
                        className="w-4 h-4 appearance-none bg-slate-200 text-white rounded-[0.2rem] relative border-2 border-transparent checked:border-transparent checked:bg-[#3699FE] checked:before:block checked:before:content-['✓'] checked:before:absolute checked:before:inset-0 checked:before:text-white checked:before:flex checked:before:items-center checked:before:justify-center transition-all"
                        checked={selectedItems.includes(transaction_id)}
                        onChange={() => {
                          setSelectedItems((prev) =>
                            prev.includes(transaction_id)
                              ? prev.filter((id) => id !== transaction_id)
                              : [...prev, transaction_id]
                          );
                        }}
                      />
                    </td>
                    <td className='py-3'>
                      <span
                        className={`font-semibold ${
                          transaction_type === '판매'
                            ? 'text-red-500'
                            : transaction_type === '구매'
                            ? 'text-[#1bc5bd]'
                            : ''
                        }`}
                      >
                        {transaction_type}
                      </span>
                    </td>
                    <td className='py-3'>
                      <div className='text-slate-700'>
                        {financial_product.product_name}
                      </div>
                      <div className='text-slate-500'>
                        {financial_product.ticker}
                      </div>
                    </td>
                    <td className='py-3 text-slate-700'>{formattedDate}</td>
                    <td className='py-3 text-slate-700'>{quantity}</td>
                    <td className='py-3 text-slate-700'>
                      {getDisplayAmount(price, currency)}
                    </td>

                    <td className='py-3'>
                      <p
                        className={`font-semibold ${
                          yoyakValue >= 0 ? 'text-[#1bc5bd]' : 'text-red-500'
                        }`}
                      >
                        {yoyakDisplay}
                      </p>

                      {transaction_type === '판매' && profitRate && (
                        <>
                          <p
                            className={`${
                              profitRate < 0 ? 'text-red-500' : 'text-[#1bc5bd]'
                            } font-semibold`}
                          >
                            {profitRateDisplayValue}
                          </p>
                          <p
                            className={`${
                              profitRate < 0 ? 'text-red-500' : 'text-[#1bc5bd]'
                            } text-xs`}
                          >
                            {profitRate > 0 ? '+' : ''}
                            {profitRate.toFixed(2)}%
                          </p>
                        </>
                      )}
                    </td>

                    <td className='py-3'>
                      {transaction_type === '판매' && totalProfitDisplay ? (
                        <div>
                          <p
                            className={`font-semibold ${
                              (totalProfitValue || 0) >= 0
                                ? 'text-[#1bc5bd]'
                                : 'text-red-500'
                            }`}
                          >
                            {totalProfitDisplay}
                          </p>
                          {totalProfitRateDisplay && (
                            <p
                              className={`text-xs ${
                                totalProfitRate && totalProfitRate < 0
                                  ? 'text-red-500'
                                  : 'text-[#1bc5bd]'
                              }`}
                            >
                              {totalProfitRateDisplay}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className='text-slate-500 font-semibold'>----</p>
                      )}
                    </td>

                    <td className='py-3'>
                      <button
                        className='p-2 bg-[#FFE2E5] hover:bg-[#F64E60] text-[#f64e60] hover:text-white rounded-[0.5rem] transition-all'
                        onClick={() => {
                          setSingleDeleteId(transaction_id);
                          setIsTransactionsDeleteModalOpen(true);
                        }}
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className='border-t'>
              <tr>
                <td className='py-3'></td>
                <td className='py-3 font-semibold text-slate-700'>Total</td>
                <td className='py-3'></td>
                <td className='py-3'></td>
                <td className='py-3'></td>
                <td className='py-3'></td>
                <td className='py-3'></td>

                <td className='py-3 font-semibold'>
                  {displayCurrency === 'original' ? (
                    hasMultipleCurrencies ? (
                      <span className='text-slate-500'>---</span>
                    ) : (
                      <span
                        className={`${
                          totalProfitAll >= 0
                            ? 'text-[#1bc5bd]'
                            : 'text-red-500'
                        }`}
                      >
                        {formatCurrency(
                          totalProfitAll,
                          uniqueCurrencies[0] as SupportedCurrency
                        )}
                      </span>
                    )
                  ) : (
                    <span
                      className={`${
                        totalProfitConverted >= 0
                          ? 'text-[#1bc5bd]'
                          : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(
                        totalProfitConverted,
                        selectedCurrency as SupportedCurrency
                      )}
                    </span>
                  )}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className='flex justify-between mt-6'>
          <div className='flex flex-row gap-2'>
            <button
              className='w-8 h-8 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex justify-center items-center rounded-md transition-all'
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft width={16} height={16} />
            </button>
            <button
              className='w-8 h-8 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex justify-center items-center rounded-md transition-all'
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft width={16} height={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageToShow =
                totalPages <= 5
                  ? i + 1
                  : currentPage <= 3
                  ? i + 1
                  : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i;
              return (
                <button
                  key={pageToShow}
                  className={`w-8 h-8 text-sm ${
                    currentPage === pageToShow
                      ? 'text-white bg-[#3699ff]'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  } flex justify-center items-center rounded-md transition-all`}
                  onClick={() => handlePageChange(pageToShow)}
                >
                  {pageToShow}
                </button>
              );
            })}

            <button
              className='w-8 h-8 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex justify-center items-center rounded-md transition-all'
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight width={16} height={16} />
            </button>
            <button
              className='w-8 h-8 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex justify-center items-center rounded-md transition-all'
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight width={16} height={16} />
            </button>
          </div>
          <div className='flex flex-row items-center gap-4'>
            <select
              className='px-4 py-2 text-slate-700 bg-slate-100 text-sm rounded-md'
              value={perPage}
              onChange={handlePerPageChange}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className='text-slate-700 text-sm'>
              {totalTransactions}개 중 {startIndex}-{endIndex} 보기
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
