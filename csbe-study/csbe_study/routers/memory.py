import os
import sys
import resource
import threading
import tracemalloc
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

from fastapi import APIRouter

router = APIRouter(prefix="/memory", tags=["memory"])


def _get_rss_mb():
    """현재 프로세스의 max RSS를 MB 단위로 반환"""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    if sys.platform == "darwin":
        # macOS: ru_maxrss는 bytes 단위
        return usage.ru_maxrss / (1024 * 1024)
    else:
        # Linux: ru_maxrss는 KB 단위
        return usage.ru_maxrss / 1024


def _process_worker_info():
    """프로세스 워커에서 자신의 PID와 RSS를 반환"""
    return {
        "pid": os.getpid(),
        "rss_mb": round(_get_rss_mb(), 2),
    }


def _process_worker_with_alloc(size_mb):
    """프로세스 워커에서 메모리를 할당한 뒤 RSS를 반환"""
    # 실제 물리 메모리를 할당 (Copy-on-Write 우회)
    data = bytearray(size_mb * 1024 * 1024)
    for i in range(0, len(data), 4096):
        data[i] = 1

    rss = _get_rss_mb()
    pid = os.getpid()
    del data
    return {"pid": pid, "rss_mb": round(rss, 2)}


def _thread_worker_info():
    """스레드 워커에서 자신의 PID와 스레드 ID를 반환"""
    return {
        "pid": os.getpid(),
        "thread_id": threading.current_thread().ident,
        "rss_mb": round(_get_rss_mb(), 2),
    }


# ─────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────


@router.get("/info")
def memory_info():
    """현재 프로세스 메모리 정보"""
    return {
        "pid": os.getpid(),
        "rss_mb": round(_get_rss_mb(), 2),
        "recursion_limit": sys.getrecursionlimit(),
    }


@router.get("/process-test/{count}")
def process_test(count: int, size_mb: int = 0):
    """N개 프로세스 워커 생성 후 각 워커의 메모리를 측정

    - size_mb=0: 워커만 생성 (Python 런타임 오버헤드만 측정)
    - size_mb>0: 워커마다 size_mb만큼 메모리를 추가 할당
    """
    main_rss = _get_rss_mb()

    worker_fn = _process_worker_info if size_mb == 0 else _process_worker_with_alloc
    with ProcessPoolExecutor(max_workers=count) as executor:
        if size_mb == 0:
            futures = [executor.submit(worker_fn) for _ in range(count)]
        else:
            futures = [executor.submit(worker_fn, size_mb) for _ in range(count)]
        workers = [f.result() for f in futures]

    return {
        "worker_type": "process",
        "worker_count": count,
        "size_mb_per_worker": size_mb,
        "main_process": {"pid": os.getpid(), "rss_mb": round(main_rss, 2)},
        "workers": workers,
        "total_rss_mb": round(main_rss + sum(w["rss_mb"] for w in workers), 2),
        "unique_pids": len(set(w["pid"] for w in workers)),
    }


@router.get("/thread-test/{count}")
def thread_test(count: int):
    """N개 스레드 워커 생성 후 메모리를 측정"""
    with ThreadPoolExecutor(max_workers=count) as executor:
        futures = [executor.submit(_thread_worker_info) for _ in range(count)]
        workers = [f.result() for f in futures]
        main_rss = _get_rss_mb()  # 스레드가 아직 살아있는 동안 측정

    return {
        "worker_type": "thread",
        "worker_count": count,
        "main_process": {"pid": os.getpid(), "rss_mb": round(main_rss, 2)},
        "workers": workers,
        "total_rss_mb": round(main_rss, 2),
        "unique_pids": len(set(w["pid"] for w in workers)),
    }


@router.get("/recursive/{depth}")
def recursive_test(depth: int):
    """지정된 깊이까지 재귀 호출"""

    def _recurse(n, current=0):
        if current >= n:
            return current
        return _recurse(n, current + 1)

    try:
        result = _recurse(depth)
        return {
            "depth": depth,
            "result": "success",
            "recursion_limit": sys.getrecursionlimit(),
        }
    except RecursionError as e:
        return {
            "depth": depth,
            "result": "RecursionError",
            "message": str(e),
            "recursion_limit": sys.getrecursionlimit(),
        }


@router.get("/heap-growth")
def heap_growth():
    """Heap 메모리 증가 패턴 관찰 (tracemalloc 사용)"""
    tracemalloc.start()
    results = []
    data = []

    for i in range(10):
        # 10만 개씩 추가
        data.extend(range(i * 100_000, (i + 1) * 100_000))
        current, peak = tracemalloc.get_traced_memory()
        results.append(
            {
                "items": len(data),
                "current_mb": round(current / (1024 * 1024), 2),
                "peak_mb": round(peak / (1024 * 1024), 2),
            }
        )

    tracemalloc.stop()
    del data

    return results
