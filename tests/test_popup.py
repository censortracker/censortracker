import pytest
from selenium import webdriver

chrome_ext_url = 'chrome-extension://kcjbdcgbeblfmjphklkmbonkkmfoffhk/'


@pytest.fixture
def chrome():
    options = webdriver.ChromeOptions()
    options.add_extension('./tests/bin/censortracker.crx')
    driver = webdriver.Chrome(chrome_options=options)
    yield driver
    driver.close()


def test_ori_found(chrome):
    chrome.get('https://2ch.hk')
    assert "Два.ч" in chrome.title
    chrome.get(f'{chrome_ext_url}/popup.html')
    assert 'Censor Tracker' in chrome.title
