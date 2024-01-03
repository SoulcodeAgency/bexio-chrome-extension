# FAQ

* Automaper doesn't select anything
  * The issue is probably that there was no match or multiple matches got the same score. Using "inspect" from your browser, you can check the `console` for more details and stats, about the scores. The log is grouped by the row number of your entries. This should give you enough hints to see which words made how many points and maybe helps to identify the right tagging words or keywords to change the scores in the future.
  * Also this feature can still get improved in the future, it probably heavily depends on the users ussage, so a general perfect solution might not be possible.
