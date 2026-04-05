#!/usr/bin/env python3
"""HKD 레스토랑 데이터 수집 CLI

Usage:
    python -m scrapers.main --platform kakao --output data/collected_restaurants.json
    python -m scrapers.main --platform naver --query "한경면 맛집"
    python -m scrapers.main --platform diningcode --query "BBQ 제주한경"
"""

import argparse
import json
import logging
import os

# .env 파일 로드
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from .diningcode_scraper import DiningcodeScraper
from .kakao_scraper import KakaoScraper
from .naver_scraper import NaverScraper


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def collect_kakao(args) -> list:
    """카카오 API로 레스토랑 수집"""
    scraper = KakaoScraper()
    keywords = [
        "한경면 음식점",
        "한경면 맛집",
        "한경면 카페",
        "한경면 분식",
        "저지리 음식점",
        "판포리 음식점",
        "고산리 음식점",
        "신창리 음식점",
        "협재 음식점",
        "한림 음식점",
        "한경면 치킨",
        "한경면 중국집",
        "한경면 횟집",
        "한경면 고기",
        "협재 카페",
        "한림 카페",
        "협재 맛집",
        "한림 맛집",
    ]
    if args.query:
        keywords = [args.query]

    restaurants = scraper.search_restaurants(keywords, pages=3)
    logging.info("카카오: %d개 레스토랑 수집 완료", len(restaurants))
    return [r.to_api_dict() for r in restaurants]


def collect_naver(args) -> list:
    """네이버 플레이스에서 검색"""
    scraper = NaverScraper()
    query = args.query or "한경면 맛집"
    places = scraper.search(query)
    logging.info("네이버: %d개 결과", len(places))
    return places


def collect_diningcode(args) -> list:
    """다이닝코드에서 검색"""
    scraper = DiningcodeScraper()
    query = args.query or "한경면 맛집"
    results = scraper.search(query)
    logging.info("다이닝코드: %d개 결과", len(results))
    return results


def main():
    parser = argparse.ArgumentParser(description="HKD 레스토랑 데이터 수집")
    parser.add_argument(
        "--platform",
        "-p",
        choices=["kakao", "naver", "diningcode"],
        default="kakao",
        help="수집 플랫폼 (기본: kakao)",
    )
    parser.add_argument("--query", "-q", help="검색 키워드")
    parser.add_argument("--output", "-o", help="출력 JSON 파일 경로")
    parser.add_argument("--verbose", "-v", action="store_true", help="상세 로그")

    args = parser.parse_args()
    setup_logging(args.verbose)

    collectors = {
        "kakao": collect_kakao,
        "naver": collect_naver,
        "diningcode": collect_diningcode,
    }

    results = collectors[args.platform](args)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        logging.info("결과 저장: %s (%d개)", args.output, len(results))
    else:
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
