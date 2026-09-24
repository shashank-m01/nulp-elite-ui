import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import BoxCard from "components/Card";
import Box from "@mui/material/Box";
import Search from "components/search";
import SearchBox from "components/search";
import Filter from "components/filter";
import contentData from "../../assets/contentSerach.json";
import RandomImage from "../../assets/cardRandomImgs.json";
import Grid from "@mui/material/Grid";
import Footer from "components/Footer";
import Header from "components/header";
import Container from "@mui/material/Container";
import * as contentService from "../../services/contentService";
import queryString from "query-string";
import Pagination from "@mui/material/Pagination";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import NoResult from "pages/content/noResultFound";
import { t } from "i18next";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import appConfig from "../../configs/appConfig.json";
const urlConfig = require("../../configs/urlConfig.json");
import ToasterCommon from "../ToasterCommon";
import Carousel from "react-multi-carousel";
import DomainCarousel from "components/domainCarousel";
import domainWithImage from "../../assets/domainImgForm.json";
import DrawerFilter from "components/drawerFilter";
const routeConfig = require("../../configs/routeConfig.json");
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import FloatingChatIcon from "components/FloatingChatIcon";
import SkeletonLoader from "components/skeletonLoader";
import * as util from "../../services/utilService";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import MyPosts from "../profile/MyPosts";
import { Button } from "@mui/material";
import Groups2OutlinedIcon from "@mui/icons-material/Groups2Outlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
const responsive = {
  superLargeDesktop: {
    // the naming can be any, depends on you.
    breakpoint: { max: 4000, min: 3000 },
    items: 5,
  },
  desktop: {
    breakpoint: { max: 3000, min: 1024 },
    items: 8,
  },
  tablet: {
    breakpoint: { max: 1024, min: 464 },
    items: 2,
  },
  mobile: {
    breakpoint: { max: 464, min: 0 },
    items: 1,
  },
};

const ContentList = (props) => {
  const [search, setSearch] = useState(true);
  const location = useLocation();
  const [pageNumber, setPageNumber] = useState(1);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({});
  const [domainfilter, setDomainfilter] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [category, setCategory] = useState([]);
  const navigate = useNavigate();
  const [domain, setDomain] = useState(location.state?.domain || undefined);
  const [domainName, setDomainName] = useState(
    location.state?.domainName || undefined
  );
  const [domainList, setDomainList] = useState([]);
  const { domainquery } = location.state || {};
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useTranslation();
  const [toasterOpen, setToasterOpen] = useState(false);
  const [toasterMessage, setToasterMessage] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);
  const [channelData, setChannelData] = React.useState(true);
  const [globalSearchQuery, setGlobalSearchQuery] = useState(
    location.state?.globalSearchQuery || undefined
  );
  const [searchQuery, setSearchQuery] = useState(globalSearchQuery || "");
  const [contentTypeFilter, setContentTypeFilter] = useState([]);
  const [subDomainFilter, setSubDomainFilter] = useState([]);
  const [contentCount, setContentCount] = useState(0);
  const [orgId, setOrgId] = useState();
  const [framework, setFramework] = useState();
  const [headerSearch, setHeaderSearch] = useState("");
  const [isDomain, setIsDomain] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [forumPosts, setForumPosts] = useState([]);
  const [forumLoading, setForumLoading] = useState(false);
  const [forumError, setForumError] = useState(null);
  const [categorySlug, setCategorySlug] = useState("");


  const showErrorMessage = (msg) => {
    setToasterMessage(msg);
    setTimeout(() => {
      setToasterMessage("");
    }, 2000);
    setToasterOpen(true);
  };

  useEffect(() => {
    if (location.state?.domain) {
      setIsDomain(true);
    }
    fetchData();
    fetchUserData();
    const random = getRandomValue();
  }, [filters, search, currentPage, domainfilter]);

  useEffect(() => {
    fetchData();
  }, [domain]);

  useEffect(() => {
    setCurrentPage(1);
    fetchData();
  }, [contentTypeFilter]);
  useEffect(() => {
    setCurrentPage(1);
    fetchData();
  }, [subDomainFilter]);

  useEffect(() => {
    fetchData();
    setHeaderSearch(globalSearchQuery);
    if (headerSearch) {
      setSearchQuery(headerSearch || "");
    }
  }, [globalSearchQuery]);

  useEffect(() => {
    setCurrentPage(1);
    if (headerSearch) {
      setSearchQuery(headerSearch || "");
    }
  }, [headerSearch]);

  useEffect(() => {
    if (
      (location.state?.globalSearchQuery &&
        location.state?.globalSearchQuery !== globalSearchQuery) ||
      location.state?.globalSearchQuery === ""
    ) {
      setGlobalSearchQuery(location.state?.globalSearchQuery);
    }
  }, [location.state?.globalSearchQuery, globalSearchQuery]);

  useEffect(() => {
    const fetchForumPosts = async () => {
      if (tabValue !== 1 || !searchQuery) return;
      setForumLoading(true);
      setForumError(null);
      try {
        const response = await fetch(
          `/discussion/api/search?in=titlesposts&term=${encodeURIComponent(
            searchQuery
          )}&matchWords=any&by=&categories=&searchChildren=false&hasTags=&replies=&repliesFilter=atleast&timeFilter=newer&timeRange=&sortBy=relevance&sortDirection=desc&showAs=posts`
        );
        if (!response.ok) throw new Error("Failed to fetch discussion posts");
        const data = await response.json();
        setForumPosts(data.posts || []);
      } catch (err) {
        setForumError(err.message || "Error fetching discussion posts");
        console.log("err", err);
      } finally {
        setForumLoading(false);
      }
    };
    fetchForumPosts();
  }, [tabValue, searchQuery]);


  useEffect(() => {
    // get category id from domain
    const fetchCategoryId = async () => {
      const response = await fetch(`/discussion/api/categories`);
      const data = await response.json();
      const categoryId = data.categories.find(
        (item) => item.name === domainName
      )?.cid;
      console.log("domainName", domainName);
      console.log("domain", domain);
      console.log("categoryId", categoryId);
      console.log("data", data);
      setCategorySlug(
        data.categories.find((item) => item.name === domainName)?.slug || ""
      );
      return categoryId || "";
    };

    const fetchForumPosts = async () => {
      const categoryId = await fetchCategoryId();
      if (tabValue !== 1 || !domain) return;
      setForumLoading(true);
      setForumError(null);
      try {
        const response = await fetch(
          `/discussion/api/search?in=titlesposts&term=${encodeURIComponent(
            searchQuery || ""
          )}&matchWords=all&by=&categories[]=${categoryId}&searchChildren=true&hasTags=&replies=&repliesFilter=atleast&timeFilter=newer&timeRange=&sortBy=topic.postcount&sortDirection=desc&showAs=posts`
        );
        if (!response.ok) throw new Error("Failed to fetch discussion posts");
        const data = await response.json();
        setForumPosts(data.posts || []);
      } catch (err) {
        setForumError(err.message || "Error fetching discussion posts");
        console.log("err", err);
      } finally {
        setForumLoading(false);
      }
    };
    fetchForumPosts();
  }, [tabValue, domain]);


  const handleFilterChange = (selectedOptions) => {
    const selectedValues = selectedOptions.map((option) => option.value);
    setFilters({ ...filters, se_gradeleverl: selectedValues });
  };

  const handlefilter = (selectedOption) => {
    const selectedValue = selectedOption.map((option) => option.value);
    setDomainfilter({ ...domainfilter, se_board: selectedValue });
  };

  const buildRequestData = () => {
    const primaryCategory = contentTypeFilter.length > 0
      ? contentTypeFilter
      : ["Collection","Resource","Course","eTextbook","Explanation Content","Practice Question Set","ExplanationResource","Practice Resource","Exam Question","Good Practices","Reports","Manual/SOPs"];

    const boardFilter = domainfilter.se_board
      ? { se_boards: domainfilter.se_board }
      : domainName
      ? { se_boards: [domainName] }
      : {};

    const hasQuery = search.query || globalSearchQuery;

    return {
      request: {
        filters: {
          status: ["Live"],
          primaryCategory,
          ...boardFilter,
          se_gradeLevels: subDomainFilter?.length > 0 ? subDomainFilter : [],
        },
        limit: 20,
        query: search.query || globalSearchQuery,
        offset: 20 * (currentPage - 1),
        ...(!hasQuery && { sort_by: { lastUpdatedOn: "desc" } }),
      },
    };
  };

  const updatePagination = (count) => {
    const total = Number(count);
    setTotalPages(total <= 20 ? 1 : Math.ceil(total / 20));
    setContentCount(total === 0 ? 0 : Math.min(total, 20));
  };

  const fetchData = async () => {
    const newPath = location.pathname + "?" + currentPage;
    sessionStorage.setItem("previousRoutes", newPath);
    setIsLoading(true);
    setError(null);

    const requestData = buildRequestData();
    const req = JSON.stringify(requestData);
    const headers = { "Content-Type": "application/json" };

    try {
      const url = `${urlConfig.URLS.PUBLIC_PREFIX}${urlConfig.URLS.CONTENT.SEARCH}?orgdetails=${appConfig.ContentPlayer.contentApiQueryParams.orgdetails}&licenseDetails=${appConfig.ContentPlayer.contentApiQueryParams.licenseDetails}`;
      const response = await contentService.getAllContents(url, req, headers);

      updatePagination(response.data.result.count);
      setData(response.data.result);
    } catch (error) {
      showErrorMessage(t("FAILED_TO_FETCH_DATA"));
    } finally {
      setIsLoading(false);
    }
  };

  const getRandomValue = () => {
    const randomIndex = RandomImage;
    return randomIndex;
  };
  const handleChange = (event, value) => {
    if (value !== pageNumber) {
      setPageNumber(value);
      setCurrentPage(value);
      setData({});
      navigate(`${routeConfig.ROUTES.CONTENTLIST_PAGE.CONTENTLIST}?${value}`, {
        state: { domain: domain },
        replace: true,
      });
      fetchData();
    }
  };
  const handleGoBack = () => {
    navigate(-1);
  };

  const fetchGradeLevels = async () => {
    const defaultFramework = localStorage.getItem("defaultFramework");
    try {
      const url = `${urlConfig.URLS.PUBLIC_PREFIX}${urlConfig.URLS.FRAMEWORK.READ}/${framework}?categories=${urlConfig.params.framework}`;
      const response = await fetch(url);
      const data = await response.json();
      if (
        data.result &&
        data.result.framework &&
        data.result.framework.categories
      ) {
        const gradeLevelCategory = data.result.framework.categories.find(
          (category) => category.identifier === "nulp_gradelevel"
        );
        if (gradeLevelCategory && gradeLevelCategory.terms) {
          const gradeLevelsOptions = gradeLevelCategory.terms.map((term) => ({
            value: term.code,
            label: term.name,
          }));
          setGradeLevels(gradeLevelsOptions);
        }
      }
    } catch (error) {
      console.error("Error fetching grade levels:", error);
      showErrorMessage(t("FAILED_TO_FETCH_DATA"));
    }
  };

  const fetchUserData = async () => {
    try {
      const uservData = await util.userData();
      setOrgId(uservData?.data?.result?.response?.rootOrgId);
      setFramework(uservData?.data?.result?.response?.framework?.id[0]);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };
  useEffect(() => {
    if (orgId && framework) {
      Fetchdomain();
      fetchGradeLevels();
    }
  }, [orgId, framework]);

  const Fetchdomain = async () => {
    const defaultFramework = localStorage.getItem("defaultFramework");
    try {
      const url = `${urlConfig.URLS.PUBLIC_PREFIX}${urlConfig.URLS.FRAMEWORK.READ}/${framework}?orgdetails=${urlConfig.params.framework}`;

      const response = await fetch(url);

      if (response.ok) {
        const responseData = await response.json();
        if (
          responseData.result &&
          responseData.result.framework &&
          responseData.result.framework.categories &&
          responseData.result.framework.categories.length > 0 &&
          responseData.result.framework.categories[0].terms
        ) {
          const domainOptions =
            responseData.result.framework.categories[0].terms.map((term) => ({
              value: term.code,
              label: term.name,
            }));
          const categories = responseData.result.framework.categories;
          const selectedIndex = categories.findIndex(
            (category) => category.code === "board"
          );

          setCategory(domainOptions);
          responseData.result.framework.categories[selectedIndex].terms?.map(
            (term) => {
              setCategory(term);
              if (domainWithImage) {
                domainWithImage.result.form.data.fields.map((imgItem) => {
                  if ((term && term.code) === (imgItem && imgItem.code)) {
                    term["image"] = imgItem.image ? imgItem.image : "";
                  }
                });
              }
            }
          );
          const domainList =
            responseData?.result?.framework?.categories[selectedIndex].terms;
          setDomainList(domainList);
        }
      } else {
        showErrorMessage(t("FAILED_TO_FETCH_DATA"));
        throw new Error(t("FAILED_TO_FETCH_DATA"));
      }
    } catch (error) {
      console.log("Error fetching domain data:", error);
      showErrorMessage(t("FAILED_TO_FETCH_DATA"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (contentId, courseType) => {
    util.setCourseOrigin();
    if (courseType === "Course") {
      navigate(
        `${routeConfig.ROUTES.JOIN_COURSE_PAGE.JOIN_COURSE}?${contentId}`
      );
    } else {
      navigate(`${routeConfig.ROUTES.PLAYER_PAGE.PLAYER}?id=${contentId}`);
    }
  };

  const handleDomainFilter = (query, domainName) => {
    setDomain(query);
    setPageNumber(1);
    setCurrentPage(1);
    setData({});
    setDomainName(domainName);
    // navigate(`${routeConfig.ROUTES.CONTENTLIST_PAGE.CONTENTLIST}?1`, {
    //   state: { domain: query },
    // });
  };

  const handleSearch = () => {
    navigate(`${routeConfig.ROUTES.CONTENTLIST_PAGE.CONTENTLIST}?1`, {
      state: { globalSearchQuery: searchQuery },
    });
  };


  const handleInputChange = (event) => {
    setSearchQuery(event.target.value);
    console.log("value", event.target.value);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      fetchData();
    }
  };
  // Function to handle data from the child
  const handlefilterChanges = (selectedFilters) => {
    setContentTypeFilter(selectedFilters.contentFilter || []);
    setSubDomainFilter(selectedFilters.subDomainFilter || []);
    // fetchData();
  };

  useEffect(() => {

    if (localStorage.getItem("playerVisited") === "true") {
      localStorage.removeItem("playerVisited");

      window.location.reload();
    }
  }, [location.search]);

  const handleTabChange = (event, newValue) => {

    setTabValue(newValue);
  };

  return (
    <div>
      <Header globalSearchQuery={globalSearchQuery} />
      {toasterMessage && <ToasterCommon response={toasterMessage} />}
      <Box>
        <Box
          className="lg-hide header-bg"
          style={{ alignItems: "center", paddingLeft: "23px" }}
        >
          <TextField
            placeholder={t("What do you want to learn today?  ")}
            variant="outlined"
            size="small"
            fullWidth
            value={searchQuery}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="searchField"
            InputProps={{
              endAdornment: (
                <IconButton
                  type="submit"
                  aria-label="search"
                  onClick={handleSearch}
                >
                  <SearchIcon />
                </IconButton>
              ),
            }}
          />
        </Box>
        <Box>
          {domainList && domainList.length > 0 ? (
            <DomainCarousel
              // className={`my-class ${
              //   activeStates[index] ? "carousel-active-ui" : ""
              // }`}
              onSelectDomain={handleDomainFilter}
              selectedDomainCode={domain}
              domains={domainList}
              keepOpen={isDomain}
            />
          ) : (
            <SkeletonLoader />
            //CircularProgress color="inherit" />
          )}
        </Box>

        <Container
          maxWidth="xl"
          className="allContent xs-pb-20  pb-30 content-list eventTab mt-180"
        >
          {/* <Box style={{ margin: "20px 0" }}> */}
          {/* <domainCarousel></domainCarousel> */}
          {/* <Box
            style={{ display: "flex", justifyContent: "space-between" }}
            className="filter-domain"
          >
            <Filter
              options={gradeLevels}
              label="Filter by Sub-Domain"
              onChange={handleFilterChange}
            />
            {!domain && (
              <Filter
                options={category}
                label="Filter by Domain"
                onChange={handlefilter}
              />
            )}
          </Box> */}
          {/* </Box> */}
          <Box
            className="d-flex mr-20 my-20"
            style={{ alignItems: "center", justifyContent: "space-between" }}
          >
            {domainName || searchQuery ? (
              <Box
                sx={{ marginTop: "10px", alignItems: "center" }}
                className="d-flex h3-title xs-d-none"
              >
                <Box className="h3-custom-title">
                  {domainName && !searchQuery
                    ? t("YOU_ARE_VIEWING_CONTENTS_FOR")
                    : t("YOU_ARE_SHOWING_CONTENTS_FOR")}
                </Box>
                <Box
                  sx={{
                    fontSize: "16px",
                    fontWeight: "600",
                    paddingLeft: "5px",
                  }}
                  className="text-blueShade2 h4-custom"
                >
                  {[searchQuery, domainName].filter(Boolean).join(", ")}

                </Box>
              </Box>
            ) : (
              <Box sx={{ marginTop: "10px" }}></Box>
            )}
            <Link onClick={handleGoBack} className="viewAll xs-hide mr-22">
              {t("BACK")}
            </Link>
          </Box>
          <Box className="h3-custom-title">
            {searchQuery &&
              tabValue !== 1 &&
              `Showing ${contentCount} out of ${data?.count || 0} results`}
          </Box>

          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="content tabs"
          >
            <Tab
              label="Courses / Contents"
              className="tab-text profile-tab"
              icon={<MenuBookOutlinedIcon />}
            />
            <Tab
              label="Discussion Forum"
              className="tab-text profile-tab"
              icon={<Groups2OutlinedIcon />}
            />
          </Tabs>

          {tabValue === 0 && (
            <Grid container spacing={2} className="pt-8 mt-15">
              <Grid
                item
                xs={12}
                md={4}
                lg={3}
                className="sm-p-25 left-container  flter-btn w-100 xs-m-10"
                style={{
                  padding: "0",
                  borderRight: "none",
                  background: "#f9fafc",
                }}
              >
                <DrawerFilter
                  SelectedFilters={handlefilterChanges}
                  renderedPage="contentlist"
                  domainCode={domain}
                />
              </Grid>
              <Grid
                item
                xs={12}
                md={8}
                lg={9}
                className=" height-none lg-pl-12 "
                style={{ paddingTop: "0" }}
              >
                <Box textAlign="center" padding="10">
                  <Box>
                    {isLoading ? (
                      <p>{t("LOADING")}</p>
                    ) : error ? (
                      <Alert severity="error">{error}</Alert>
                    ) : data && data.content && data.content.length > 0 ? (
                      <div>
                        <Box className="custom-card">
                          {/* <Grid
                        container
                        spacing={2}
                        style={{ margin: "20px 0", marginBottom: "10px" }}
                      > */}
                          {data?.content?.map((items, index) => (
                            // <Grid
                            //   item
                            //   xs={6}
                            //   md={6}
                            //   lg={3}
                            //   style={{ marginBottom: "10px" }}
                            //   key={items.identifier}
                            // >
                            <Box
                              className="custom-card-box"
                              key={items.identifier}
                            >
                              <BoxCard
                                items={items}
                                index={index}
                                onClick={() =>
                                  handleCardClick(
                                    items.identifier,
                                    items.contentType
                                  )
                                }
                              ></BoxCard>
                            </Box>

                            // </Grid>
                          ))}
                          <div className="blankCard"></div>
                        </Box>
                        {/* </Grid> */}
                        <Pagination
                          count={totalPages}
                          page={pageNumber}
                          onChange={handleChange}
                        />
                      </div>
                    ) : (
                      <NoResult /> // Render NoResult component when there are no search results
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Container
              maxWidth="xl"
              className="allContent xs-pb-20 pb-30 content-list eventTab mt-180"
            >
              {forumPosts?.length > 6 && (
                <Box display="flex" justifyContent="flex-end" mb={2}>
                  <Button
                    onClick={() => {
                      if (categorySlug) {
                        window.location.href = `/discussion-forum/category/${categorySlug}`;
                      } else if (searchQuery) {
                        window.location.href = `/discussion-forum/search?term=${encodeURIComponent(
                          searchQuery
                        )}`;
                      }
                    }}

                    variant="contained"
                    sx={{
                      marginTop: "13px",
                      mr: 2,
                      display: { xs: "none", sm: "inline-flex" },
                      backgroundColor: "#057184",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "9px 32px",
                      "&:hover": {
                        backgroundColor: "#045d6e", // optional: hover state
                      },
                    }}
                  >
                    {t("VIEW_ALL")}
                  </Button>
                </Box>
              )}
              {forumPosts && forumPosts?.length > 0 ? (
                <MyPosts
                  loading={forumLoading}
                  error={forumError}
                  posts={forumPosts?.slice(0, 6)}
                />
              ) : (
                <NoResult />
              )}
            </Container>
          )}
        </Container>
        <FloatingChatIcon />
      </Box>
      <Footer />
    </div>
  );
};
export default ContentList;
