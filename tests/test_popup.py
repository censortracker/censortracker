import unittest
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options


class TestDistributors(unittest.TestCase):

    def setUp(self):
        options = webdriver.ChromeOptions()
        options.add_extension('./tests/bin/censortracker.crx')
        self.driver = webdriver.Chrome(chrome_options=options)
        self.chrome_ext_url = 'chrome-extension://kcjbdcgbeblfmjphklkmbonkkmfoffhk/'

    def test_ori_found(self):
        self.driver.get('https://2ch.hk')
        self.assertIn("Два.ч", self.driver.title)

        self.driver.get(f'{self.chrome_ext_url}/popup.html')
        self.assertIn('Censor Tracker', self.driver.title)

    def tearDown(self):
        self.driver.close()


if __name__ == "__main__":
    unittest.main()
