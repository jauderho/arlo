# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots[
    "test_ballot_comparison_container_manifest 1"
] = """Container,Tabulator,Batch Name,Ballot Number,Imprinted ID,Ticket Numbers,Already Audited,Audit Board
CONTAINER2,TABULATOR1,BATCH3,2,1-3-2,0.009464169703578658,N,Audit Board #1
CONTAINER2,TABULATOR1,BATCH3,13,1-3-13,0.008481195646651660,N,Audit Board #1
CONTAINER2,TABULATOR2,BATCH3,27,2-3-27,0.010200999825644035,N,Audit Board #1
CONTAINER2,TABULATOR2,BATCH3,49,2-3-49,0.001536470617324124,N,Audit Board #1
CONTAINER2,TABULATOR2,BATCH4,21,2-4-21,0.002353099293607490,N,Audit Board #1
CONTAINER0,TABULATOR2,BATCH8,47,2-8-47,0.006763450800570999,N,Audit Board #2
CONTAINER1,TABULATOR2,BATCH1,15,2-1-15,0.006700879199748225,N,Audit Board #2
CONTAINER1,TABULATOR2,BATCH2,44,2-2-44,0.000676487665235813,N,Audit Board #2
CONTAINER3,TABULATOR1,BATCH5,6,1-5-6,0.008743453399529091,N,Audit Board #3
CONTAINER3,TABULATOR1,BATCH5,25,1-5-25,0.004991423116656603,N,Audit Board #3
CONTAINER6,TABULATOR2,BATCH6,30,2-6-30,0.009230841414615846,N,Audit Board #3
"""
