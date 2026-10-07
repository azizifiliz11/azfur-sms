import { db } from "./db";
import { CalculatedCatalogItem, Country, ServiceItem } from "./types";
import { heroSms } from "./hero-sms";
import { tcmb } from "./tcmb";

export const pricingEngine = {
  /**
   * Maliyet üzerinden kâr marjlı satış fiyatını hesaplar
   */
  calculatePrice(
    originalCostUsd: number,
    serviceCode: string,
    customRate?: number
  ): { finalPriceTry: number; costTry: number; profitTry: number; usedRate: number } {
    const settings = db.getSettings();
    const rate = customRate || settings.exchangeRateToTry || settings.lastTcmbRate || 49.20;
    const costTry = originalCostUsd * rate;

    // Özel servis kârı kontrol et
    const custom = settings.serviceCustomMargins?.[serviceCode];
    const marginPercent = custom?.marginPercent !== undefined ? custom.marginPercent : settings.globalMarginPercent;
    const fixedFee = custom?.fixedFee !== undefined ? custom.fixedFee : settings.globalFixedFee;

    const priceWithMargin = costTry * (1 + marginPercent / 100) + fixedFee;
    // En az 3.00 TL taban fiyat ve 2 basamak yuvarlama
    const finalPriceTry = Number(Math.max(3.0, Math.ceil(priceWithMargin * 10) / 10).toFixed(2));
    const profitTry = Number((finalPriceTry - costTry).toFixed(2));

    return {
      finalPriceTry,
      costTry: Number(costTry.toFixed(2)),
      profitTry,
      usedRate: rate,
    };
  },

  /**
   * Tüm ülkeler ve servisler için canlı stok ve kâr marjlı fiyat kataloğunu üretir
   */
  async getCatalog(selectedCountryId?: number): Promise<{
    countries: Country[];
    services: ServiceItem[];
    catalog: CalculatedCatalogItem[];
    settings: {
      currency: string;
      marginPercent: number;
      fixedFee: number;
      rate: number;
      isTcmbAuto: boolean;
      lastTcmbFetchTime?: string;
    };
  }> {
    const settings = db.getSettings();

    // Otomatik TCMB kuru açıksa canlı kuru güncelle
    let effectiveRate = settings.exchangeRateToTry || 49.20;
    if (settings.useTcmbAutoRate) {
      try {
        const live = await tcmb.getLiveRate();
        effectiveRate = live.rate;
      } catch (e) {
        effectiveRate = settings.lastTcmbRate || settings.exchangeRateToTry || 49.20;
      }
    }

    const [allCountries, allServices, allPrices] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      heroSms.getPrices(selectedCountryId),
    ]);

    // Gizli ülke ve servisleri filtrele
    const visibleCountries = allCountries.filter(
      (c) => c.visible !== 0 && !settings.hiddenCountries.includes(c.id)
    );
    const visibleServices = allServices.filter(
      (s) => !settings.hiddenServices.includes(s.code)
    );

    const countryIdToUse = selectedCountryId !== undefined ? selectedCountryId : (visibleCountries[0]?.id || 62);
    const countryObj = visibleCountries.find((c) => c.id === countryIdToUse) || visibleCountries[0];
    const countryPrices = allPrices[String(countryIdToUse)] || {};

    const catalog: CalculatedCatalogItem[] = [];

    for (const service of visibleServices) {
      const priceInfo = countryPrices[service.code];
      const cost = priceInfo?.cost || 0.15;
      const stock = priceInfo?.count || (priceInfo?.physicalCount ? priceInfo.physicalCount * 10 : 0);

      const { finalPriceTry } = this.calculatePrice(cost, service.code, effectiveRate);

      catalog.push({
        serviceCode: service.code,
        serviceName: service.name,
        countryId: countryObj ? countryObj.id : countryIdToUse,
        countryName: countryObj ? countryObj.eng : `Country ${countryIdToUse}`,
        countryFlag: countryObj ? countryObj.flag || "🌐" : "🌐",
        originalCostUsd: cost,
        calculatedPriceTry: finalPriceTry,
        stock: stock,
        icon: service.icon,
      });
    }

    // Popülerlik ve stok sayısına göre sırala
    catalog.sort((a, b) => {
      if (a.stock > 0 && b.stock === 0) return -1;
      if (a.stock === 0 && b.stock > 0) return 1;
      return b.stock - a.stock;
    });

    return {
      countries: visibleCountries,
      services: visibleServices,
      catalog,
      settings: {
        currency: settings.currencySymbol,
        marginPercent: settings.globalMarginPercent,
        fixedFee: settings.globalFixedFee,
        rate: effectiveRate,
        isTcmbAuto: settings.useTcmbAutoRate,
        lastTcmbFetchTime: settings.lastTcmbFetchTime,
      },
    };
  },
};
